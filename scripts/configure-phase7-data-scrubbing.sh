#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"
FIELDS_FILE="${PROJECT_ROOT}/scripts/phase7-sensitive-fields.json"
PYTHON_SCRIPT="${PROJECT_ROOT}/scripts/configure_phase7_data_scrubbing.py"
PII_CONFIG_FILE="${PROJECT_ROOT}/scripts/phase7-relay-pii-config.json"
REFRESH_SCRIPT="${PROJECT_ROOT}/scripts/refresh_phase7_relay_config.py"
SELF_HOSTED_DIR="${PROJECT_ROOT}/.runtime/self-hosted"

for required_file in "${TOKEN_FILE}" "${FIELDS_FILE}" "${PII_CONFIG_FILE}" "${PYTHON_SCRIPT}" "${REFRESH_SCRIPT}"; do
  if [[ ! -f "${required_file}" ]]; then
    echo "필수 파일을 찾을 수 없습니다: ${required_file}" >&2
    exit 1
  fi
done

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
: "${SENTRY_PROJECT:=frontend-poc}"
: "${SENTRY_PROJECTS:=${SENTRY_PROJECT},frontend-membership,frontend-remittance,frontend-payment}"

ORG_API_URL="${SENTRY_URL%/}/api/0/organizations/${SENTRY_ORG}/"
AUTH_HEADER="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"
FIELDS_JSON="$(jq -c '.' "${FIELDS_FILE}")"
PII_CONFIG_JSON="$(jq -c '.' "${PII_CONFIG_FILE}")"

echo "1/5 조직·프로젝트 스크러빙 설정 적용"
docker compose \
  --project-directory "${SELF_HOSTED_DIR}" \
  --file "${SELF_HOSTED_DIR}/docker-compose.yml" \
  exec -T \
  --env "PHASE7_SENTRY_ORG=${SENTRY_ORG}" \
  --env "PHASE7_SENTRY_PROJECTS=${SENTRY_PROJECTS}" \
  --env "PHASE7_SENSITIVE_FIELDS_JSON=${FIELDS_JSON}" \
  --env "PHASE7_RELAY_PII_CONFIG_JSON=${PII_CONFIG_JSON}" \
  web \
  /.venv/bin/sentry shell --no-imports \
  <"${PYTHON_SCRIPT}"

echo "2/5 비동기 project config invalidation 완료 대기"
sleep 7

docker compose \
  --project-directory "${SELF_HOSTED_DIR}" \
  --file "${SELF_HOSTED_DIR}/docker-compose.yml" \
  exec -T \
  --env "PHASE7_SENTRY_ORG=${SENTRY_ORG}" \
  --env "PHASE7_SENTRY_PROJECTS=${SENTRY_PROJECTS}" \
  --env "PHASE7_RELAY_PII_CONFIG_JSON=${PII_CONFIG_JSON}" \
  web \
  /.venv/bin/sentry shell --no-imports \
  <"${REFRESH_SCRIPT}"

echo "3/5 Relay 새 project config 로드"
docker compose \
  --project-directory "${SELF_HOSTED_DIR}" \
  --file "${SELF_HOSTED_DIR}/docker-compose.yml" \
  restart relay \
  >/dev/null

for attempt in {1..30}; do
  if docker compose \
    --project-directory "${SELF_HOSTED_DIR}" \
    --file "${SELF_HOSTED_DIR}/docker-compose.yml" \
    exec -T nginx sh -lc 'nc -z relay 3000' \
    2>/dev/null; then
    echo "  Relay TCP 준비 완료"
    break
  fi
  if [[ "${attempt}" == "30" ]]; then
    echo "Relay가 제한 시간 안에 준비되지 않았습니다." >&2
    exit 1
  fi
  sleep 2
done

echo "4/5 조직 설정 API 검증"
curl --fail-with-body --silent --show-error \
  --header "${AUTH_HEADER}" \
  "${ORG_API_URL}" \
  | jq -r '
    "  dataScrubber=\(.dataScrubber)",
    "  dataScrubberDefaults=\(.dataScrubberDefaults)",
    "  scrubIPAddresses=\(.scrubIPAddresses)",
    "  sensitiveFields=\(.sensitiveFields | length)개",
    "  relayPiiConfigConfigured=\(.relayPiiConfig != null)"
  '

echo "5/5 프로젝트 설정 API 검증"
IFS=',' read -r -a project_slugs <<<"${SENTRY_PROJECTS}"
for project_slug in "${project_slugs[@]}"; do
  PROJECT_API_URL="${SENTRY_URL%/}/api/0/projects/${SENTRY_ORG}/${project_slug}/"
  curl --fail-with-body --silent --show-error \
    --header "${AUTH_HEADER}" \
    "${PROJECT_API_URL}" \
    | jq -r --arg project_slug "${project_slug}" '
      "  project=\($project_slug)",
      "    dataScrubber=\(.dataScrubber)",
      "    dataScrubberDefaults=\(.dataScrubberDefaults)",
      "    scrubIPAddresses=\(.scrubIPAddresses)",
      "    sensitiveFields=\(.sensitiveFields | length)개",
      "    relayPiiConfigConfigured=\(.relayPiiConfig != null)",
      "    relayPiiApplications=\((.relayPiiConfig | fromjson | .applications | length) // 0)개"
    '
done
