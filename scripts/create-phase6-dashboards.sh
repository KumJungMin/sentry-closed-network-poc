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
  existing_id="$({
    curl --fail-with-body --silent --show-error \
      --header "${AUTH_HEADER}" \
      "${API_BASE}/dashboards/"
  } | jq -r --arg title "${title}" '.[] | select(.title == $title) | .id' | head -n 1)"

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
