#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SENTRY_DIR="${PROJECT_ROOT}/.runtime/self-hosted"
DRILLDOWN_COMPOSE_FILE="${PROJECT_ROOT}/sentry-ui-customization/compose.drilldown.yml"
DRILLDOWN_IMAGE="sentry-self-hosted-drilldown:26.8.0"

if [[ ! -f "${SENTRY_DIR}/docker-compose.yml" ]]; then
  echo "Sentry runtime을 찾을 수 없습니다: ${SENTRY_DIR}" >&2
  echo "먼저 Phase 2 설치를 완료하세요." >&2
  exit 1
fi

COMPOSE_ARGS=(-f "${SENTRY_DIR}/docker-compose.yml")
if [[ -f "${DRILLDOWN_COMPOSE_FILE}" ]]; then
  COMPOSE_ARGS+=(-f "${DRILLDOWN_COMPOSE_FILE}")
fi

require_drilldown_image() {
  if [[ -f "${DRILLDOWN_COMPOSE_FILE}" ]] \
    && ! docker image inspect "${DRILLDOWN_IMAGE}" >/dev/null 2>&1; then
    echo "Sentry 업무 오류 상세보기 이미지가 없습니다: ${DRILLDOWN_IMAGE}" >&2
    echo "먼저 다음 명령으로 이미지를 빌드하세요." >&2
    echo "docker build --file sentry-ui-customization/Dockerfile --tag ${DRILLDOWN_IMAGE} sentry-ui-customization" >&2
    exit 1
  fi
}

cd "${SENTRY_DIR}"

case "${1:-status}" in
  start)
    require_drilldown_image
    docker compose "${COMPOSE_ARGS[@]}" up -d --wait
    ;;
  stop)
    # 볼륨은 보존합니다. 데이터가 삭제되는 `down -v`는 사용하지 않습니다.
    docker compose "${COMPOSE_ARGS[@]}" down
    ;;
  restart)
    require_drilldown_image
    docker compose "${COMPOSE_ARGS[@]}" down
    docker compose "${COMPOSE_ARGS[@]}" up -d --wait
    ;;
  status)
    docker compose "${COMPOSE_ARGS[@]}" ps -a
    ;;
  health)
    curl --fail --silent --show-error http://127.0.0.1:9000/_health/
    echo
    ;;
  logs)
    if [[ -z "${2:-}" ]]; then
      echo "사용법: $0 logs <service-name>" >&2
      exit 1
    fi
    docker compose "${COMPOSE_ARGS[@]}" logs --tail=200 "${2}"
    ;;
  *)
    echo "사용법: $0 {start|stop|restart|status|health|logs <service-name>}" >&2
    exit 1
    ;;
esac
