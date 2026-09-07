# 가입·송금·결제 도메인 플로우 관측 가이드

이 문서는 가입, 송금, 결제 앱의 URL 기반 플로우를 실행하고 Self-hosted Sentry에서 이탈률, 한 사용자의 행동, 시스템 오류, Replay와 원본 소스를 조사하는 절차를 설명합니다.

## 수집 범위

| 앱 | 주소 | Sentry 프로젝트 | 기본 `user.id` |
| --- | --- | --- | --- |
| 가입 | `http://127.0.0.1:5174/signup/terms` | `frontend-membership` | `CUSTOMER-MEMBERSHIP-001` |
| 송금 | `http://127.0.0.1:5175/remittance/recipient` | `frontend-remittance` | `CUSTOMER-REMITTANCE-001` |
| 결제 | `http://127.0.0.1:5176/payment/order` | `frontend-payment` | `CUSTOMER-PAYMENT-001` |

각 단계는 `react-router-dom`의 독립 경로입니다. 주소를 직접 입력하거나 새로고침해도 같은 화면이 열립니다. 기존 `test-app`은 화면 확인용으로만 남아 있고 Sentry 초기화가 강제로 차단되어 있습니다.

## 실행

처음 한 번 Sentry 프로젝트별 로컬 환경 파일을 생성합니다. 인증 토큰과 DSN은 Git에 저장하거나 터미널에 출력하지 않습니다.

```bash
./scripts/configure-domain-app-envs.sh
```

터미널 두 개에서 내부 집계 서버와 세 앱을 실행합니다.

```bash
pnpm analytics
```

`pnpm analytics`는 정확 집계 API와 Sentry snapshot publisher를 함께 실행합니다. publisher는 60초마다 세 플로우를 다시 계산하므로, 마지막 사용자가 화면을 닫아 추가 이벤트가 없어도 유예 시간 경과 후 이탈 확정이 Sentry에 반영됩니다.

```bash
pnpm dev:flows
```

전체 자동 검증은 다음 한 명령으로 실행합니다.

```bash
pnpm verify:flows
```

실행 중인 집계 값을 즉시 한 번 발행하려면 다음 명령을 사용합니다.

```bash
pnpm publish:flow-snapshots
```

## Sentry 대시보드

대시보드 정의를 생성하거나 현재 정의로 갱신합니다.

```bash
./scripts/create-domain-flow-dashboards.sh
```

Sentry에서 다음 두 대시보드를 사용합니다.

- `PoC - 도메인 프론트 현황`: 시스템 오류, 영향을 받은 사용자, 세션 리플레이 연결, 서비스·단계·오류 코드, URL 성능, 배포 버전, 정확한 이탈률 집계
- `PoC - 사용자 플로우 조사`: 최근 행동 로그, 행동·단계별 로그, 사용자와 Replay가 연결된 오류

현재 로컬 Sentry의 직접 주소는 각각 `/organizations/sentry/dashboard/9/`, `/organizations/sentry/dashboard/10/`입니다. 다른 환경에서는 ID가 달라질 수 있으므로 대시보드 제목을 기준으로 찾습니다.

### 플로우 이탈률

`PoC - 도메인 프론트 현황`의 `플로우별 이탈률`을 봅니다. 이 값은 Sentry 이벤트 수를 단순 계산한 결과가 아닙니다. 내부 집계 서버가 `attempt ID`별 최초 도달과 다음 단계 진행을 중복 제거한 뒤 집계 snapshot만 Sentry span으로 발행합니다.

사용자 지정 Sentry UI가 적용된 환경에서는 이 위젯이 일반 표 대신 퍼널 카드로 보입니다. 각 단계는 `flow.step_index` 순서로 정렬되고, `flow.step_display`와 `flow.page_path`로 화면 순서와 URL을 함께 확인할 수 있습니다.

- 가입: 30분 후 이탈 확정
- 송금: 15분 후 이탈 확정
- 결제: 5분 후 이탈 확정
- 유예 시간 안의 미진행은 `이탈 판단 대기`, 이후에는 `이탈 확정`으로 구분
- `이 절차 취소` 선택은 유예 시간 없이 이탈 확정

### 한 사용자의 전체 행동

1. `PoC - 사용자 플로우 조사`에서 `최근 플로우 행동 로그` 제목을 선택해 Logs 상세 화면으로 이동합니다.
2. 검색 조건에 `user.id:CUSTOMER-MEMBERSHIP-001`처럼 원본 고객 ID를 추가합니다.
3. 한 번의 시도만 좁히려면 표에서 확인한 `flow.attempt_id` 조건도 추가합니다.
4. `timestamp` 오름차순으로 정렬하면 URL 진입, 제출, 성공·거절·오류, 완료 순서를 재구성할 수 있습니다.

Logs에는 `user.id`, `service`, `flow.slug`, `flow.step`, `flow.event`, `flow.attempt_id`, `page.path`가 함께 저장됩니다. `flow.slug`는 서버의 개인정보 필드명 `name` 규칙과 충돌하지 않는 플로우 식별자입니다. 원본 `user.id`는 검색을 위해 보존하지만 이메일, 전화번호, 이름, 입력값, URL query와 fragment는 제거합니다.

### 오류와 Replay, 원본 소스

`PoC - 사용자 플로우 조사`의 `사용자·세션 리플레이가 연결된 오류`에서 이벤트를 엽니다. 시스템 오류만 Issue와 error Replay를 생성합니다. 정상 세션과 정책상 거절은 Replay를 전송하지 않습니다.

이벤트 상세에서 다음을 같은 키로 연결합니다.

- `user.id`: 원본 고객 식별자
- `flow.attempt_id`: 한 번의 플로우 시도
- `flow.step`: 오류가 난 화면 단계
- `error_code`: 프론트에서 분류한 안정적인 오류 코드
- `replayId`: 오류 직전 버퍼가 포함된 Session Replay
- Stack Trace: 업로드한 release와 Debug ID가 일치할 때 원본 TypeScript 위치

배포 빌드의 원본 소스를 확인하려면 빌드 후 source map을 업로드하고, 반드시 그 빌드에서 새 오류를 발생시킵니다. 기존 이벤트는 나중에 업로드한 source map으로 재처리되지 않습니다.

```bash
pnpm build
./scripts/upload-domain-app-sourcemaps.sh
```

## 재현 코드

가입의 본인 확인, 송금·결제의 인증 단계에 다음 값을 입력합니다.

| 값 | 결과 | Sentry 처리 |
| --- | --- | --- |
| `OK` 또는 일반 값 | 다음 단계 진행 | 행동 Logs와 정확 집계 |
| `DECLINE` | 업무 정책 거절 | 경고 Log만 생성, Issue·Replay 없음 |
| `TIMEOUT` | 시스템 오류 | 오류 Log, Issue, error Replay 생성 |

입력 검증 실패는 사용자의 수정 가능한 행동이므로 Issue를 만들지 않습니다. 예상하지 못한 JavaScript 오류와 API 기술 실패는 원본 `Error` 객체를 capture하여 stack trace를 유지합니다.

## 추가 프론트 관측 영역

- `reactRouterBrowserTracingIntegration`: URL별 navigation transaction과 span
- Web Vitals: 브라우저 tracing에 연결된 LCP, CLS, INP 등의 성능 진단
- Sentry Logs: Issue로 승격하지 않을 정상 행동과 정책상 거절
- error-only Replay: 오류 전후 화면 재현, 전체 기본 마스킹과 민감 영역 차단
- release·environment·service 태그: 배포 및 앱 경계별 회귀 비교
- 내부 정확 집계: 샘플링·중복 전송에 영향을 받지 않는 모수와 이탈률
