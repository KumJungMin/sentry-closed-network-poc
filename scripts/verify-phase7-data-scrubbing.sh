#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"
RUNTIME_FILE="${PROJECT_ROOT}/test-app/.env.local"
EVENT_BUILDER="${PROJECT_ROOT}/test-app/scripts/build-phase7-verification-event.ts"
VERIFY_MODE="${1:-client}"

if [[ "${VERIFY_MODE}" != "client" && "${VERIFY_MODE}" != "--server-probe" ]]; then
  echo "사용법: $0 [--server-probe]" >&2
  exit 1
fi

for required_file in "${TOKEN_FILE}" "${RUNTIME_FILE}"; do
  if [[ ! -f "${required_file}" ]]; then
    echo "필수 환경 파일을 찾을 수 없습니다: ${required_file}" >&2
    exit 1
  fi
done

if [[ ! -f "${EVENT_BUILDER}" ]]; then
  echo "클라이언트 보안 이벤트 생성기를 찾을 수 없습니다: ${EVENT_BUILDER}" >&2
  exit 1
fi

set -a
# 토큰과 DSN은 Git에서 제외되며 값은 출력하지 않습니다.
source "${TOKEN_FILE}"
source "${RUNTIME_FILE}"
set +a

if [[ -z "${SENTRY_AUTH_TOKEN:-}" || -z "${VITE_SENTRY_DSN:-}" ]]; then
  echo "SENTRY_AUTH_TOKEN 또는 VITE_SENTRY_DSN이 비어 있습니다." >&2
  exit 1
fi

: "${SENTRY_URL:=http://127.0.0.1:9000}"
: "${SENTRY_ORG:=sentry}"
: "${SENTRY_PROJECT:=frontend-poc}"

if [[ ! "${VITE_SENTRY_DSN}" =~ ^(https?)://([^@]+)@([^/]+)/([0-9]+)$ ]]; then
  echo "VITE_SENTRY_DSN 형식을 해석할 수 없습니다." >&2
  exit 1
fi

DSN_SCHEME="${BASH_REMATCH[1]}"
DSN_PUBLIC_KEY="${BASH_REMATCH[2]}"
DSN_HOST="${BASH_REMATCH[3]}"
PROJECT_ID="${BASH_REMATCH[4]}"
INGEST_URL="${DSN_SCHEME}://${DSN_HOST}/api/${PROJECT_ID}/envelope/"
EVENT_ID="$(openssl rand -hex 16)"
TIMESTAMP="$(date -u +'%Y-%m-%dT%H:%M:%S.000Z')"
AUTH_HEADER="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"
ENVELOPE_FILE="$(mktemp)"
EVENT_FILE="$(mktemp)"
STORED_FILE="$(mktemp)"
trap 'rm -f "${ENVELOPE_FILE}" "${EVENT_FILE}" "${STORED_FILE}"' EXIT

jq -n \
  --arg event_id "${EVENT_ID}" \
  --arg timestamp "${TIMESTAMP}" \
  '{
    event_id: $event_id,
    timestamp: $timestamp,
    platform: "javascript",
    level: "error",
    environment: "local",
    release: "frontend-poc@0.1.0",
    logger: "phase7.server-scrub-verification",
    exception: {values: [{type: "Phase7PrivacyVerification", value: "[PoC] Phase 7 server scrub verification"}]},
    tags: {
      security_phase: "phase7",
      test_case: "server-pii-scrubbing",
      synthetic_data_only: "true"
    },
    user: {
      id: "raw-user-id-phase7",
      username: "FAKE-NAME-PHASE7",
      email: "phase7.person@example.invalid",
      ip_address: "203.0.113.77"
    },
    request: {
      method: "POST",
      url: "http://127.0.0.1:5173/payment?email=phase7.person@example.invalid",
      headers: {
        Authorization: "Bearer FAKE-AUTHORIZATION-PHASE7",
        Cookie: "session=FAKE-COOKIE-PHASE7"
      },
      data: "FAKE-RAW-REQUEST-PHASE7"
    },
    contexts: {
      phase7_sensitive_input: {
        customer_name: "FAKE-NAME-PHASE7",
        phone_number: "010-0000-0000",
        email_address: "phase7.person@example.invalid",
        account_number: "000-0000-0000-00",
        resident_registration_number: "000000-1000000",
        ci: "FAKE-CI-PHASE7-ONLY",
        otp_code: "000000",
        access_token: "FAKE-ACCESS-TOKEN-PHASE7",
        refresh_token: "FAKE-REFRESH-TOKEN-PHASE7",
        authorization: "Bearer FAKE-AUTHORIZATION-PHASE7",
        cookie: "session=FAKE-COOKIE-PHASE7",
        sender_info: "FAKE-SENDER-PHASE7",
        recipient_info: "FAKE-RECIPIENT-PHASE7",
        raw_request: "FAKE-RAW-REQUEST-PHASE7",
        raw_response: "FAKE-RAW-RESPONSE-PHASE7",
        input_form: "FAKE-FULL-FORM-PHASE7",
        transaction_id: "FAKE-TRANSACTION-ID-PHASE7",
        safe_business_state: "privacy-scrub-test"
      }
    },
    breadcrumbs: {values: [{
      timestamp: $timestamp,
      category: "phase7.security-test",
      message: "Authorization: Bearer FAKE-AUTHORIZATION-PHASE7",
      data: {
        url: "http://127.0.0.1:5173/api/payment?email=phase7.person@example.invalid",
        request_body: "FAKE-RAW-REQUEST-PHASE7",
        response_body: "FAKE-RAW-RESPONSE-PHASE7"
      }
    }]}
  }' >"${EVENT_FILE}"

if [[ "${VERIFY_MODE}" == "client" ]]; then
  node --experimental-strip-types \
    "${EVENT_BUILDER}" \
    "${EVENT_ID}" \
    "${TIMESTAMP}" \
    >"${EVENT_FILE}"
fi

{
  jq -cn --arg event_id "${EVENT_ID}" --arg dsn "${VITE_SENTRY_DSN}" \
    '{event_id: $event_id, dsn: $dsn}'
  jq -cn '{type: "event"}'
  jq -c '.' "${EVENT_FILE}"
} >"${ENVELOPE_FILE}"

if [[ "${VERIFY_MODE}" == "client" ]]; then
  echo "1/3 beforeSend 정제 합성 이벤트 전송 (event id=${EVENT_ID})"
else
  echo "1/3 서버 방어 probe 원본 이벤트 전송 (event id=${EVENT_ID})"
fi
curl --fail-with-body --silent --show-error \
  --header "Content-Type: application/x-sentry-envelope" \
  --header "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${DSN_PUBLIC_KEY}, sentry_client=phase7-verifier/1.0" \
  --data-binary "@${ENVELOPE_FILE}" \
  "${INGEST_URL}" \
  >/dev/null

EVENT_API="${SENTRY_URL%/}/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/events/${EVENT_ID}/"
echo "2/3 Sentry 저장 완료 대기"
for attempt in {1..20}; do
  HTTP_CODE="$(curl --silent --show-error \
    --header "${AUTH_HEADER}" \
    --output "${STORED_FILE}" \
    --write-out '%{http_code}' \
    "${EVENT_API}")"
  if [[ "${HTTP_CODE}" == "200" ]]; then
    break
  fi
  if [[ "${attempt}" == "20" ]]; then
    echo "저장된 이벤트를 제한 시간 안에 조회하지 못했습니다: HTTP ${HTTP_CODE}" >&2
    exit 1
  fi
  sleep 2
done

echo "3/3 저장본의 원본 민감값 부재 확인"
LEAKED_LABELS=()
while IFS=$'\t' read -r label value; do
  if rg --fixed-strings --quiet -- "${value}" "${STORED_FILE}"; then
    LEAKED_LABELS+=("${label}")
  fi
done <<'VALUES'
name	FAKE-NAME-PHASE7
phone	010-0000-0000
email	phase7.person@example.invalid
account_number	000-0000-0000-00
resident_registration_number	000000-1000000
ci	FAKE-CI-PHASE7-ONLY
otp	000000
access_token	FAKE-ACCESS-TOKEN-PHASE7
refresh_token	FAKE-REFRESH-TOKEN-PHASE7
authorization	FAKE-AUTHORIZATION-PHASE7
cookie	FAKE-COOKIE-PHASE7
sender	FAKE-SENDER-PHASE7
recipient	FAKE-RECIPIENT-PHASE7
raw_request	FAKE-RAW-REQUEST-PHASE7
raw_response	FAKE-RAW-RESPONSE-PHASE7
input_form	FAKE-FULL-FORM-PHASE7
transaction_id	FAKE-TRANSACTION-ID-PHASE7
raw_user_id	raw-user-id-phase7
VALUES

if (( ${#LEAKED_LABELS[@]} > 0 )); then
  echo "민감정보 원본이 남아 있습니다: ${LEAKED_LABELS[*]}" >&2
  exit 1
fi

if ! jq -e '.. | strings | select(. == "privacy-scrub-test")' "${STORED_FILE}" >/dev/null; then
  echo "안전한 업무 상태까지 제거되어 스크러빙 범위가 과도합니다." >&2
  exit 1
fi

echo "  통과: 18개 원본 민감값 없음, 안전한 업무 상태 유지"
echo "  확인 URL: ${SENTRY_URL%/}/organizations/${SENTRY_ORG}/issues/?query=${EVENT_ID}"
