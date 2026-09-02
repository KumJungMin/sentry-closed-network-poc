#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"
DEFINITIONS_FILE="${PROJECT_ROOT}/scripts/service-projects.json"

if [[ ! -f "${TOKEN_FILE}" ]]; then
  echo "토큰 파일을 찾을 수 없습니다: ${TOKEN_FILE}" >&2
  exit 1
fi

set -a
# 로컬 secret 파일의 값은 출력하거나 Git에 저장하지 않습니다.
source "${TOKEN_FILE}"
set +a

: "${SENTRY_URL:=http://127.0.0.1:9000}"
: "${SENTRY_ORG:=sentry}"
: "${SENTRY_TEAM:=sentry}"

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "SENTRY_AUTH_TOKEN이 비어 있습니다." >&2
  exit 1
fi

AUTH_HEADER="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"
PROJECTS_URL="${SENTRY_URL%/}/api/0/organizations/${SENTRY_ORG}/projects/"
CREATE_URL="${SENTRY_URL%/}/api/0/teams/${SENTRY_ORG}/${SENTRY_TEAM}/projects/"
existing_projects="$(curl --fail-with-body --silent --show-error --header "${AUTH_HEADER}" "${PROJECTS_URL}")"

while IFS= read -r definition; do
  slug="$(jq -r '.slug' <<<"${definition}")"
  name="$(jq -r '.name' <<<"${definition}")"

  if jq -e --arg slug "${slug}" '.[] | select(.slug == $slug)' <<<"${existing_projects}" >/dev/null; then
    echo "이미 존재: ${slug}"
    continue
  fi

  curl --fail-with-body --silent --show-error \
    --request POST \
    --header "${AUTH_HEADER}" \
    --header "Content-Type: application/json" \
    --data "${definition}" \
    "${CREATE_URL}" \
    | jq -r --arg name "${name}" '"생성 완료: \($name) (slug=\(.slug), id=\(.id))"'
done < <(jq -c '.[]' "${DEFINITIONS_FILE}")
