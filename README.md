# Self-hosted Sentry 폐쇄망 PoC

현재 컴퓨터 안에 Self-hosted Sentry와 작은 프론트엔드 앱을 구성해, 오류가 폐쇄망 내부에서도 수집·조회되는지 학습하고 검증하는 프로젝트입니다.

## 현재 진행 상태

| Phase | 내용 | 상태 |
| --- | --- | --- |
| 0 | 환경 및 요구사항 확인 | 완료 |
| 1 | 개념 및 아키텍처 문서 | 완료 |
| 2 | Self-hosted Sentry 설치 | 완료 |
| 3 | 최소 테스트 애플리케이션 | 완료 |
| 4 | 기본 데이터 수집 검증 | 완료 |
| 5 | 커스텀 데이터 수집 | 완료 |
| 6 | 대시보드 구성 및 한계 검증 | 완료 |
| 7 | 개인정보 및 금융정보 보호 | 완료 |
| 8 | 폐쇄망 축소 테스트 | 완료 |
| 9 | 회사 적용 문서 | 완료 |

## 문서

- [Phase 0 환경 점검](docs/00-environment.md)
- [Sentry 기본 개념](docs/01-concepts.md)
- [로컬 및 폐쇄망 아키텍처](docs/02-local-architecture.md)
- [Self-hosted Sentry 설치 및 운영](docs/03-installation.md)
- [React SDK와 테스트 이벤트](docs/04-sdk-and-events.md)
- [기본 데이터 수집과 Source map 검증](docs/05-basic-collection.md)
- [금융 WebView 커스텀 데이터 수집](docs/05-custom-data.md)
- [대시보드 구성과 지원 범위 검증](docs/06-dashboards.md)
- [개인정보·금융정보 보호와 실제 저장 검증](docs/07-security.md)
- [폐쇄망 축소 테스트와 외부 의존성](docs/08-closed-network.md)
- [회사 폐쇄망 도입·운영 가이드](docs/09-company-adoption.md)

## 최종 결론

Phase 0~9가 모두 완료됐습니다. 외부 통신이 차단된 Sentry 서버에서 핵심 오류 수집·조회, Source map 업로드, 재시작과 데이터 재조회가 동작했습니다. 회사 도입 시 필요한 사양, 반입물, DNS/HTTPS, 백업·복구, 업데이트, 취약점 대응, 권한과 담당 업무는 [Phase 9 회사 적용 가이드](docs/09-company-adoption.md)에 정리했습니다.

[Phase 7](docs/07-security.md)의 Relay 서버 단독 개인정보 제거 문제도 해결했습니다. Advanced 설정에 누락된 `$user.id` selector를 추가하고 project config cache 갱신을 자동화했으며, 합성 민감 원본 18개가 저장되지 않는 것을 실제 이벤트로 확인했습니다. 실제 회사 환경에서도 신규 프로젝트와 버전 업데이트마다 같은 검증을 반복해야 합니다.

## 재현 명령

```bash
# Sentry와 테스트 앱 상태
./scripts/sentry.sh status
curl -fsS http://127.0.0.1:9000/_health/

# 폐쇄망 격리와 전체 검증
./scripts/phase8-network.sh isolate
./scripts/verify-phase8-closed-network.sh

# 검증 후 반드시 일반 네트워크 복구
./scripts/phase8-network.sh restore
./scripts/verify-phase8-closed-network.sh --recheck
```

> Sentry 서버는 `http://127.0.0.1:9000/`, React 테스트 앱은 `http://127.0.0.1:5173/`에서 실행 중입니다. 계정 비밀번호와 프로젝트 DSN은 Git에 기록하지 않습니다.
