#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SENTRY_DIR="${PROJECT_ROOT}/.runtime/self-hosted"

if [[ ! -f "${SENTRY_DIR}/docker-compose.yml" ]]; then
  echo "Sentry runtime을 찾을 수 없습니다: ${SENTRY_DIR}" >&2
  echo "먼저 Phase 2 설치를 완료하세요." >&2
  exit 1
fi

cd "${SENTRY_DIR}"

case "${1:-status}" in
  start)
    docker compose up -d --wait
    ;;
  stop)
    # 볼륨은 보존합니다. 데이터가 삭제되는 `down -v`는 사용하지 않습니다.
    docker compose down
    ;;
  restart)
    docker compose down
    docker compose up -d --wait
    ;;
  status)
    docker compose ps -a
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
    docker compose logs --tail=200 "${2}"
    ;;
  *)
    echo "사용법: $0 {start|stop|restart|status|health|logs <service-name>}" >&2
    exit 1
    ;;
esac
