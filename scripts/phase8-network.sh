#!/usr/bin/env bash

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SENTRY_DIR="${PROJECT_ROOT}/.runtime/self-hosted"
COMPOSE_FILE="${SENTRY_DIR}/docker-compose.yml"
ISOLATION_FILE="${PROJECT_ROOT}/scripts/phase8-closed-network.override.yml"
NETWORK_NAME="sentry-self-hosted_default"
INGRESS_NETWORK_NAME="sentry-self-hosted_phase8-ingress"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Sentry runtime을 찾을 수 없습니다: ${COMPOSE_FILE}" >&2
  exit 1
fi

normal_compose() {
  docker compose \
    --project-directory "${SENTRY_DIR}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

isolated_compose() {
  docker compose \
    --project-directory "${SENTRY_DIR}" \
    -f "${COMPOSE_FILE}" \
    -f "${ISOLATION_FILE}" \
    "$@"
}

network_is_internal() {
  docker network inspect "${NETWORK_NAME}" --format '{{.Internal}}' 2>/dev/null
}

wait_for_host_health() {
  local attempt

  for attempt in {1..60}; do
    if curl --fail --silent --show-error \
      http://127.0.0.1:9000/_health/ >/dev/null 2>&1; then
      echo "  호스트 → Sentry health: 성공 (HTTP 200)"
      return 0
    fi
    sleep 2
  done

  echo "Sentry health가 제한 시간 안에 복구되지 않았습니다." >&2
  return 1
}

assert_isolated() {
  local internal
  internal="$(network_is_internal || true)"
  if [[ "${internal}" != "true" ]]; then
    echo "현재 Sentry 네트워크가 격리 상태가 아닙니다 (internal=${internal:-missing})." >&2
    exit 1
  fi
}

assert_ingress_boundary() {
  local attached_services

  if [[ "$(docker network inspect "${INGRESS_NETWORK_NAME}" --format '{{.Internal}}' 2>/dev/null || true)" != "false" ]]; then
    echo "호스트 진입용 네트워크를 확인하지 못했습니다." >&2
    exit 1
  fi

  attached_services="$(docker network inspect "${INGRESS_NETWORK_NAME}" \
    --format '{{range .Containers}}{{.Name}}{{"\n"}}{{end}}')"
  if [[ "${attached_services}" != "sentry-self-hosted-nginx-1" ]]; then
    echo "호스트 진입용 네트워크에는 nginx 하나만 연결되어야 합니다: ${attached_services}" >&2
    exit 1
  fi
}

probe_connections() {
  assert_isolated
  assert_ingress_boundary

  echo "1/3 네트워크 경계 확인: 내부망=internal, 진입망=nginx만 연결"

  echo "2/3 컨테이너 내부 통신 확인: web → postgres:5432"
  isolated_compose exec -T web python -c '
import socket

with socket.create_connection(("postgres", 5432), timeout=5):
    print("  성공: 내부 서비스 DNS와 TCP 연결 정상")
'

  echo "3/3 컨테이너 외부 통신 차단 확인: web → 1.1.1.1:443"
  isolated_compose exec -T web python -c '
import socket
import sys

try:
    with socket.create_connection(("1.1.1.1", 443), timeout=5):
        pass
except OSError as error:
    print(f"  예상대로 실패: {error}")
    sys.exit(0)

print("외부 IP 연결이 예상과 달리 성공했습니다.", file=sys.stderr)
sys.exit(1)
'

  wait_for_host_health
}

case "${1:-status}" in
  isolate)
    if [[ "$(network_is_internal || true)" == "true" ]]; then
      echo "Sentry 네트워크는 이미 격리 상태입니다."
      assert_ingress_boundary
      wait_for_host_health
      exit 0
    fi

    echo "1/3 Sentry 컨테이너 중지 (볼륨 보존)"
    normal_compose down

    echo "2/3 외부 라우팅이 없는 internal 네트워크로 기동"
    if ! isolated_compose up -d; then
      echo "격리 기동 실패. 일반 네트워크로 복구를 시도합니다." >&2
      isolated_compose down || true
      normal_compose up -d
      exit 1
    fi

    echo "3/3 격리 상태와 웹 진입점 확인"
    assert_isolated
    assert_ingress_boundary
    wait_for_host_health
    ;;
  probe)
    probe_connections
    ;;
  restart-isolated)
    assert_isolated
    echo "1/3 격리 상태에서 전체 컨테이너 재시작"
    isolated_compose restart
    echo "2/3 의존 서비스와 웹 진입점 복구 대기"
    isolated_compose up -d
    echo "3/3 격리 상태 유지와 웹 복구 확인"
    assert_isolated
    assert_ingress_boundary
    wait_for_host_health
    ;;
  restore)
    if [[ "$(network_is_internal || true)" != "true" ]]; then
      echo "Sentry 네트워크는 이미 일반 상태입니다."
      wait_for_host_health
      exit 0
    fi

    echo "1/3 격리 스택 중지 (볼륨 보존)"
    isolated_compose down
    echo "2/3 일반 네트워크로 기동"
    normal_compose up -d
    echo "3/3 일반 네트워크와 웹 복구 확인"
    if [[ "$(network_is_internal || true)" != "false" ]]; then
      echo "일반 네트워크 복구를 확인하지 못했습니다." >&2
      exit 1
    fi
    wait_for_host_health
    ;;
  status)
    echo "network=${NETWORK_NAME} internal=$(network_is_internal || echo missing)"
    normal_compose ps -a
    ;;
  *)
    echo "사용법: $0 {isolate|probe|restart-isolated|restore|status}" >&2
    exit 1
    ;;
esac
