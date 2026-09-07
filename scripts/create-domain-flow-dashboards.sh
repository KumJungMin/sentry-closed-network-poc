#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"
DEFINITIONS_FILE="${PROJECT_ROOT}/scripts/domain-flow-dashboards.json"

if [[ ! -f "${TOKEN_FILE}" ]]; then
  echo "토큰 파일을 찾을 수 없습니다: ${TOKEN_FILE}" >&2
  exit 1
fi

set -a
# 실제 토큰은 출력하거나 Git에 저장하지 않습니다.
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
projects="$({
  curl --fail-with-body --silent --show-error \
    --header "${AUTH_HEADER}" \
    "${API_BASE}/projects/"
})"
required_slugs="$(jq -c 'map(.projectSlugs[]) | unique' "${DEFINITIONS_FILE}")"
project_ids="$(jq -cn \
  --argjson projects "${projects}" \
  --argjson slugs "${required_slugs}" \
  '$slugs | map(. as $slug | ($projects[] | select(.slug == $slug) | .id | tonumber))')"

if [[ "$(jq 'length' <<<"${project_ids}")" -ne "$(jq 'length' <<<"${required_slugs}")" ]]; then
  echo "필요한 전용 프로젝트를 모두 찾지 못했습니다: ${required_slugs}" >&2
  exit 1
fi

echo "1/2 도메인 플로우 대시보드 정의 검증"
while IFS= read -r dashboard; do
  title="$(jq -r '.title' <<<"${dashboard}")"
  payload="$(jq -c --argjson projects "${project_ids}" 'del(.projectSlugs) | .projects = $projects' <<<"${dashboard}")"
  curl --fail-with-body --silent --show-error \
    --request POST \
    --header "${AUTH_HEADER}" \
    --header "Content-Type: application/json" \
    --data "${payload}" \
    "${API_BASE}/dashboards/?validateOnly=1" \
    >/dev/null
  echo "  검증 완료: ${title}"
done < <(jq -c '.[]' "${DEFINITIONS_FILE}")

echo "2/2 도메인 플로우 대시보드 생성 또는 업데이트"
existing_dashboards="$({
  curl --fail-with-body --silent --show-error \
    --header "${AUTH_HEADER}" \
    "${API_BASE}/dashboards/"
})"

while IFS= read -r dashboard; do
  title="$(jq -r '.title' <<<"${dashboard}")"
  payload="$(jq -c --argjson projects "${project_ids}" 'del(.projectSlugs) | .projects = $projects' <<<"${dashboard}")"
  existing_id="$(jq -r --arg title "${title}" '.[] | select(.title == $title) | .id' <<<"${existing_dashboards}" | head -n 1)"

  if [[ -n "${existing_id}" ]]; then
    curl --fail-with-body --silent --show-error \
      --request PUT \
      --header "${AUTH_HEADER}" \
      --header "Content-Type: application/json" \
      --data "${payload}" \
      "${API_BASE}/dashboards/${existing_id}/" \
      | jq -r '"  업데이트 완료: \(.title) (id=\(.id), widgets=\(.widgets | length))"'
    continue
  fi

  curl --fail-with-body --silent --show-error \
    --request POST \
    --header "${AUTH_HEADER}" \
    --header "Content-Type: application/json" \
    --data "${payload}" \
    "${API_BASE}/dashboards/" \
    | jq -r '"  생성 완료: \(.title) (id=\(.id), widgets=\(.widgets | length))"'
done < <(jq -c '.[]' "${DEFINITIONS_FILE}")
