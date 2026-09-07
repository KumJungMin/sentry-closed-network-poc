#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKEN_FILE="${PROJECT_ROOT}/test-app/.env.sentry-build-plugin"

if [[ ! -f "${TOKEN_FILE}" ]]; then
  echo "토큰 파일을 찾을 수 없습니다: ${TOKEN_FILE}" >&2
  exit 1
fi

set -a
source "${TOKEN_FILE}"
set +a

: "${SENTRY_URL:=http://127.0.0.1:9000}"
: "${SENTRY_ORG:=sentry}"

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "SENTRY_AUTH_TOKEN이 비어 있습니다." >&2
  exit 1
fi

write_app_env() {
  local app_name="$1"
  local project_slug="$2"
  local release="$3"
  local target_file="${PROJECT_ROOT}/apps/${app_name}/.env.local"
  local keys_url="${SENTRY_URL%/}/api/0/projects/${SENTRY_ORG}/${project_slug}/keys/"
  local dsn

  if [[ -f "${target_file}" && "${FORCE:-false}" != "true" ]]; then
    echo "기존 파일을 보존해 건너뜀: ${target_file} (덮어쓰려면 FORCE=true)"
    return
  fi

  dsn="$({
    curl --fail-with-body --silent --show-error \
      --header "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
      "${keys_url}"
  } | jq -r '.[0].dsn.public // empty')"
  if [[ -z "${dsn}" ]]; then
    echo "프로젝트 DSN을 찾지 못했습니다: ${project_slug}" >&2
    exit 1
  fi

  umask 077
  {
    printf 'VITE_SENTRY_DSN=%s\n' "${dsn}"
    printf 'VITE_SENTRY_ENABLED=true\n'
    printf 'VITE_SENTRY_ENVIRONMENT=local\n'
    printf 'VITE_SENTRY_TRACES_SAMPLE_RATE=1\n'
    printf 'VITE_SENTRY_LOGS_ENABLED=true\n'
    printf 'VITE_SENTRY_REPLAY_ENABLED=true\n'
    printf 'VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=1\n'
    printf 'VITE_APP_RELEASE=%s\n' "${release}"
    printf 'VITE_POC_USER_ID=CUSTOMER-%s-001\n' "$(tr '[:lower:]' '[:upper:]' <<<"${app_name%-web}")"
  } >"${target_file}"
  echo "로컬 환경 생성 완료: apps/${app_name}/.env.local (${project_slug})"
}

write_app_env "membership-web" "frontend-membership" "membership-web@0.1.0"
write_app_env "remittance-web" "frontend-remittance" "remittance-web@0.1.0"
write_app_env "payment-web" "frontend-payment" "payment-web@0.1.0"
