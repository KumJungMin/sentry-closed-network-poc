#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${PROJECT_ROOT}/test-app"
TOKEN_FILE="${APP_DIR}/.env.sentry-build-plugin"
RELEASE_NAME="frontend-poc@0.1.0-with-sourcemap"

if [[ ! -f "${TOKEN_FILE}" ]]; then
  echo "토큰 파일을 찾을 수 없습니다: ${TOKEN_FILE}" >&2
  exit 1
fi

set -a
# 실제 토큰 파일은 Git에서 제외됩니다.
source "${TOKEN_FILE}"
set +a

if [[ -z "${SENTRY_AUTH_TOKEN:-}" ]]; then
  echo "SENTRY_AUTH_TOKEN이 비어 있습니다." >&2
  exit 1
fi

: "${SENTRY_URL:=http://127.0.0.1:9000}"
: "${SENTRY_ORG:=sentry}"
: "${SENTRY_PROJECT:=frontend-poc}"

export SENTRY_URL SENTRY_ORG SENTRY_PROJECT SENTRY_AUTH_TOKEN

echo "1/3 production build 생성"
VITE_APP_RELEASE="${RELEASE_NAME}" \
  pnpm --dir "${APP_DIR}" exec vite build --sourcemap hidden

echo "2/3 JavaScript bundle에 debug ID 주입"
pnpm --dir "${APP_DIR}" exec sentry-cli sourcemaps inject "${APP_DIR}/dist"

echo "3/3 Source map artifact bundle 업로드"
pnpm --dir "${APP_DIR}" exec sentry-cli sourcemaps upload \
  --org "${SENTRY_ORG}" \
  --project "${SENTRY_PROJECT}" \
  --validate \
  "${APP_DIR}/dist"

echo "Source map 업로드 완료: ${RELEASE_NAME}"
