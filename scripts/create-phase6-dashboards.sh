#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"
DEFINITIONS_FILE="${PROJECT_ROOT}/scripts/phase6-dashboards.json"

if [[ ! -f "${TOKEN_FILE}" ]]; then
  echo "토큰 파일을 찾을 수 없습니다: ${TOKEN_FILE}" >&2
  exit 1
fi

if [[ ! -f "${DEFINITIONS_FILE}" ]]; then
  echo "대시보드 정의 파일을 찾을 수 없습니다: ${DEFINITIONS_FILE}" >&2
  exit 1
fi

set -a
# 실제 토큰 파일은 Git에서 제외되며 값은 출력하지 않습니다.
source "${TOKEN_FILE}"
set +a

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "SENTRY_AUTH_TOKEN이 비어 있습니다." >&2
  exit 1
fi

: "${SENTRY_URL:=http://127.0.0.1:9000}"
: "${SENTRY_ORG:=sentry}"

API_BASE="${SENTRY_URL%/}/api/0/organizations/${SENTRY_ORG}"
AUTH_HEADER="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"

legacy_dashboard_title() {
  case "$1" in
    "PoC - 프론트엔드 안정성") echo "PoC - Frontend Stability" ;;
    "PoC - 업무 오류 분석") echo "PoC - Business Error Breakdown" ;;
    "PoC - API 및 프론트엔드 성능") echo "PoC - API and Frontend Performance" ;;
    "PoC - 일간 오류 (24시간)") echo "PoC - Errors Daily (24h)" ;;
    "PoC - 주간 오류 (7일)") echo "PoC - Errors Weekly (7d)" ;;
    "PoC - 월간 오류 (30일)") echo "PoC - Errors Monthly (30d)" ;;
    *) echo "" ;;
  esac
}

echo "1/2 대시보드 정의 검증"
while IFS= read -r dashboard; do
  title="$(jq -r '.title' <<<"${dashboard}")"
  curl --fail-with-body --silent --show-error \
    --request POST \
    --header "${AUTH_HEADER}" \
    --header "Content-Type: application/json" \
    --data "${dashboard}" \
    "${API_BASE}/dashboards/?validateOnly=1" \
    >/dev/null
  echo "  검증 완료: ${title}"
done < <(jq -c '.[]' "${DEFINITIONS_FILE}")

echo "2/2 대시보드 생성"
while IFS= read -r dashboard; do
  title="$(jq -r '.title' <<<"${dashboard}")"
  legacy_title="$(legacy_dashboard_title "${title}")"
  existing_id="$({
    curl --fail-with-body --silent --show-error \
      --header "${AUTH_HEADER}" \
      "${API_BASE}/dashboards/"
  } | jq -r \
    --arg title "${title}" \
    --arg legacy_title "${legacy_title}" \
    '([.[] | select(.title == $title)] + [.[] | select(.title == $legacy_title)])[0].id // empty')"

  if [[ -n "${existing_id}" ]]; then
    curl --fail-with-body --silent --show-error \
      --request PUT \
      --header "${AUTH_HEADER}" \
      --header "Content-Type: application/json" \
      --data "${dashboard}" \
      "${API_BASE}/dashboards/${existing_id}/" \
      | jq -r '"  업데이트 완료: \(.title) (id=\(.id), widgets=\(.widgets | length))"'
    continue
  fi

  curl --fail-with-body --silent --show-error \
    --request POST \
    --header "${AUTH_HEADER}" \
    --header "Content-Type: application/json" \
    --data "${dashboard}" \
    "${API_BASE}/dashboards/" \
    | jq -r '"  생성 완료: \(.title) (id=\(.id), widgets=\(.widgets | length))"'
done < <(jq -c '.[]' "${DEFINITIONS_FILE}")
