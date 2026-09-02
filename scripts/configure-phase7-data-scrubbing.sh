#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"
FIELDS_FILE="${PROJECT_ROOT}/scripts/phase7-sensitive-fields.json"
PYTHON_SCRIPT="${PROJECT_ROOT}/scripts/configure_phase7_data_scrubbing.py"
PII_CONFIG_FILE="${PROJECT_ROOT}/scripts/phase7-relay-pii-config.json"
SELF_HOSTED_DIR="${PROJECT_ROOT}/.runtime/self-hosted"

for required_file in "${TOKEN_FILE}" "${FIELDS_FILE}" "${PII_CONFIG_FILE}" "${PYTHON_SCRIPT}"; do
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

ORG_API_URL="${SENTRY_URL%/}/api/0/organizations/${SENTRY_ORG}/"
PROJECT_API_URL="${SENTRY_URL%/}/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/"
AUTH_HEADER="Authorization: Bearer ${SENTRY_AUTH_TOKEN}"
FIELDS_JSON="$(jq -c '.' "${FIELDS_FILE}")"
PII_CONFIG_JSON="$(jq -c '.' "${PII_CONFIG_FILE}")"

echo "1/3 조직·프로젝트 스크러빙 설정 적용"
docker compose \
  --project-directory "${SELF_HOSTED_DIR}" \
  --file "${SELF_HOSTED_DIR}/docker-compose.yml" \
  exec -T \
  --env "PHASE7_SENTRY_ORG=${SENTRY_ORG}" \
  --env "PHASE7_SENTRY_PROJECT=${SENTRY_PROJECT}" \
  --env "PHASE7_SENSITIVE_FIELDS_JSON=${FIELDS_JSON}" \
  --env "PHASE7_RELAY_PII_CONFIG_JSON=${PII_CONFIG_JSON}" \
  web \
  /.venv/bin/sentry shell --no-imports \
  <"${PYTHON_SCRIPT}"

echo "2/3 조직 설정 API 검증"
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

echo "3/3 프로젝트 설정 API 검증"
curl --fail-with-body --silent --show-error \
  --header "${AUTH_HEADER}" \
  "${PROJECT_API_URL}" \
  | jq -r '
    "  dataScrubber=\(.dataScrubber)",
    "  dataScrubberDefaults=\(.dataScrubberDefaults)",
    "  scrubIPAddresses=\(.scrubIPAddresses)",
    "  sensitiveFields=\(.sensitiveFields | length)개",
    "  relayPiiConfigConfigured=\(.relayPiiConfig != null)",
    "  relayPiiApplications=\((.relayPiiConfig | fromjson | .applications | length) // 0)개"
  '
