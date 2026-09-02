#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"
RUNTIME_FILE="${PROJECT_ROOT}/test-app/.env.local"
LAST_EVENT_FILE="${PROJECT_ROOT}/.runtime/phase8-last-event-id"
VERIFY_MODE="${1:-full}"

if [[ "${VERIFY_MODE}" != "full" && "${VERIFY_MODE}" != "--recheck" ]]; then
  echo "사용법: $0 [--recheck]" >&2
  exit 1
fi

for required_file in "${TOKEN_FILE}" "${RUNTIME_FILE}"; do
  if [[ ! -f "${required_file}" ]]; then
    echo "필수 환경 파일을 찾을 수 없습니다: ${required_file}" >&2
    exit 1
  fi
done

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
AUTH_HEADER="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"
STORED_FILE="$(mktemp)"
ENVELOPE_FILE="$(mktemp)"
trap 'rm -f "${STORED_FILE}" "${ENVELOPE_FILE}"' EXIT

if [[ "${VERIFY_MODE}" == "full" && "$(docker network inspect sentry-self-hosted_default --format '{{.Internal}}' 2>/dev/null || true)" != "true" ]]; then
  echo "Sentry Docker 네트워크가 격리 상태가 아닙니다. 먼저 phase8-network.sh isolate를 실행하세요." >&2
  exit 1
fi

read_event_detail() {
  local event_id="$1"
  local event_api="${SENTRY_URL%/}/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/events/${event_id}/"
  local http_code
  local attempt

  for attempt in {1..30}; do
    http_code="$(curl --silent --show-error \
      --header "${AUTH_HEADER}" \
      --output "${STORED_FILE}" \
      --write-out '%{http_code}' \
      "${event_api}")"
    if [[ "${http_code}" == "200" ]]; then
      return 0
    fi
    sleep 2
  done

  echo "이벤트 상세를 제한 시간 안에 조회하지 못했습니다: HTTP ${http_code}" >&2
  return 1
}

assert_event_detail() {
  local event_id="$1"

  read_event_detail "${event_id}"
  jq -e --arg event_id "${event_id}" '
    .eventID == $event_id and
    (.title | contains("Phase8ClosedNetworkVerification")) and
    (.tags | any(.key == "closed_network" and .value == "true")) and
    (.tags | any(.key == "test_case" and .value == "phase8-new-error"))
  ' "${STORED_FILE}" >/dev/null
}

if [[ "${VERIFY_MODE}" == "--recheck" ]]; then
  if [[ ! -s "${LAST_EVENT_FILE}" ]]; then
    echo "재조회할 Phase 8 이벤트 ID가 없습니다." >&2
    exit 1
  fi

  EVENT_ID="$(tr -d '[:space:]' <"${LAST_EVENT_FILE}")"
  echo "저장된 Phase 8 이벤트 상세 재조회 (event id=${EVENT_ID})"
  assert_event_detail "${EVENT_ID}"
  echo "  통과: 기존 이벤트 상세 HTTP 200 및 핵심 필드 유지"
  echo "  확인 URL: ${SENTRY_URL%/}/organizations/${SENTRY_ORG}/issues/?query=${EVENT_ID}"
  exit 0
fi

echo "1/5 외부 통신 실패와 내부 통신 성공 확인"
"${PROJECT_ROOT}/scripts/phase8-network.sh" probe

echo "2/5 로컬 도구만 사용해 Source map 빌드·주입·내부 Sentry 업로드"
"${PROJECT_ROOT}/scripts/upload-test-app-sourcemaps.sh"

if ! find "${PROJECT_ROOT}/test-app/dist" -type f -name '*.map' -print -quit | grep -q .; then
  echo "생성된 Source map 파일을 찾지 못했습니다." >&2
  exit 1
fi

if ! rg --quiet --glob '*.js' '_sentryDebugIds|debugId=' "${PROJECT_ROOT}/test-app/dist"; then
  echo "JavaScript bundle에서 주입된 Debug ID를 찾지 못했습니다." >&2
  exit 1
fi

EVENT_ID="$(openssl rand -hex 16)"
TIMESTAMP="$(date -u +'%Y-%m-%dT%H:%M:%S.000Z')"

{
  jq -cn --arg event_id "${EVENT_ID}" --arg dsn "${VITE_SENTRY_DSN}" \
    '{event_id: $event_id, dsn: $dsn}'
  jq -cn '{type: "event"}'
  jq -cn \
    --arg event_id "${EVENT_ID}" \
    --arg timestamp "${TIMESTAMP}" \
    '{
      event_id: $event_id,
      timestamp: $timestamp,
      platform: "javascript",
      level: "error",
      environment: "closed-network-poc",
      release: "frontend-poc@0.1.0-with-sourcemap",
      logger: "phase8.closed-network-verification",
      exception: {
        values: [{
          type: "Phase8ClosedNetworkVerification",
          value: "[PoC] new error captured while Sentry egress is blocked",
          stacktrace: {
            frames: [{
              filename: "src/phase8-closed-network-test.ts",
              function: "verifyClosedNetworkIngestion",
              lineno: 8,
              colno: 1,
              in_app: true
            }]
          }
        }]
      },
      tags: {
        closed_network: "true",
        test_case: "phase8-new-error",
        synthetic_data_only: "true"
      },
      contexts: {
        phase8_verification: {
          network_boundary: "docker-internal-network",
          expected_external_result: "blocked",
          expected_internal_result: "available"
        }
      }
    }'
} >"${ENVELOPE_FILE}"

echo "3/5 격리 상태에서 새로운 오류 전송 (event id=${EVENT_ID})"
curl --fail-with-body --silent --show-error \
  --header "Content-Type: application/x-sentry-envelope" \
  --header "X-Sentry-Auth: Sentry sentry_version=7, sentry_key=${DSN_PUBLIC_KEY}, sentry_client=phase8-verifier/1.0" \
  --data-binary "@${ENVELOPE_FILE}" \
  "${INGEST_URL}" \
  >/dev/null

echo "4/5 저장 처리와 오류 상세 API 조회"
assert_event_detail "${EVENT_ID}"

echo "5/5 재시작 후 재조회용 이벤트 ID 저장"
printf '%s\n' "${EVENT_ID}" >"${LAST_EVENT_FILE}"
echo "  통과: 외부 egress 차단 중 Source map 업로드, 신규 오류 저장, 상세 조회 성공"
echo "  확인 URL: ${SENTRY_URL%/}/organizations/${SENTRY_ORG}/issues/?query=${EVENT_ID}"
