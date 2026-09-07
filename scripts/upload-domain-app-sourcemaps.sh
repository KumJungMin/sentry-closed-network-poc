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

export SENTRY_URL SENTRY_ORG SENTRY_AUTH_TOKEN

upload_app() {
  local package_name="$1"
  local app_name="$2"
  local project_slug="$3"
  local release="$4"
  local dist_dir="${PROJECT_ROOT}/apps/${app_name}/dist"

  echo "빌드: ${app_name} (${release})"
  VITE_APP_RELEASE="${release}" pnpm --dir "${PROJECT_ROOT}" --filter "${package_name}" build

  echo "Debug ID 주입: ${app_name}"
  pnpm --dir "${PROJECT_ROOT}" exec sentry-cli sourcemaps inject "${dist_dir}"

  echo "Source map 업로드: ${project_slug}"
  pnpm --dir "${PROJECT_ROOT}" exec sentry-cli sourcemaps upload \
    --org "${SENTRY_ORG}" \
    --project "${project_slug}" \
    --release "${release}" \
    --url-prefix "~/" \
    --validate \
    "${dist_dir}"
}

upload_app "@poc/membership-web" "membership-web" "frontend-membership" "membership-web@0.1.0"
upload_app "@poc/remittance-web" "remittance-web" "frontend-remittance" "remittance-web@0.1.0"
upload_app "@poc/payment-web" "payment-web" "frontend-payment" "payment-web@0.1.0"
