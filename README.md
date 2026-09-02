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
| 7 | 개인정보 및 금융정보 보호 | 대기 |
| 8 | 폐쇄망 축소 테스트 | 대기 |
| 9 | 회사 적용 문서 | 대기 |

## 문서

- [Phase 0 환경 점검](docs/00-environment.md)
- [Sentry 기본 개념](docs/01-concepts.md)
- [로컬 및 폐쇄망 아키텍처](docs/02-local-architecture.md)
- [Self-hosted Sentry 설치 및 운영](docs/03-installation.md)
- [React SDK와 테스트 이벤트](docs/04-sdk-and-events.md)
- [기본 데이터 수집과 Source map 검증](docs/05-basic-collection.md)
- [금융 WebView 커스텀 데이터 수집](docs/05-custom-data.md)
- [대시보드 구성과 지원 범위 검증](docs/06-dashboards.md)

## 다음 실행 순서

1. [Phase 6 검증 결과](docs/06-dashboards.md)를 검토합니다.
2. Sentry의 `PoC - Frontend Stability`, `PoC - Business Error Breakdown`, `PoC - API and Frontend Performance` 대시보드를 확인합니다.
3. 승인 후 Phase 7에서 개인정보·금융정보 필터링과 비식별 사용자 정책을 검증합니다.

> Sentry 서버는 `http://127.0.0.1:9000/`, React 테스트 앱은 `http://127.0.0.1:5173/`에서 실행 중입니다. 계정 비밀번호와 프로젝트 DSN은 Git에 기록하지 않습니다.
