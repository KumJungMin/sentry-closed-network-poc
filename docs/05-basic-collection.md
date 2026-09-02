# Phase 4: 기본 데이터 수집과 Source map 검증

## 검증 환경

- Self-hosted Sentry: `26.8.0`
- 조직 / 프로젝트: `sentry` / `frontend-poc`
- 테스트 앱: React `19.2.8`, `@sentry/react` `10.72.0`
- 기본 릴리스: `frontend-poc@0.1.0`
- 환경: `local`
- 검증일: 2026-08-30

실제 DSN과 인증 토큰은 Git에서 제외된 로컬 환경 파일에만 저장했다. 저장소에는 빈 예제 파일만 둔다.

## 기본 이벤트 수집 결과

테스트 앱의 7개 버튼을 격리된 Headless Chrome에서 한 번씩 실행했다. 브라우저의 Sentry envelope 응답, Sentry 이벤트 API, PostgreSQL Issue 그룹, ClickHouse 오류·Transaction 저장소를 함께 확인했다.

| 번호 | 실험 | 결과 | 확인한 내용 |
| --- | --- | --- | --- |
| 1 | 처리되지 않은 JavaScript 오류 | 성공 | `handled=false`, 브라우저 stack trace, Issue 생성 |
| 2 | `captureException` | 성공 | 앱에서 처리한 예외도 `handled=true` 이벤트로 저장 |
| 3 | `captureMessage` | 성공 | 예외 객체 없이 warning 레벨 메시지 저장 |
| 4 | 존재하지 않는 API 호출 | 성공 | GET, HTTP 404, Fetch breadcrumb와 `http_failure` Context 저장 |
| 5 | 업무 Breadcrumb 후 오류 | 성공 | 송금 화면 진입 → 금액 입력 → 수취인 검증 실패 순서 저장 |
| 6 | Tag와 Context 후 오류 | 성공 | 검색용 Tag와 상세 Context가 서로 다른 영역에 저장 |
| 7 | 약 1.2초 느린 작업 | 성공 | `poc.slow-operation`, `ui.slow-task`, 약 1,201ms Transaction 저장 |

느린 작업은 성능 데이터이므로 별도 오류 Issue를 만들지 않았다. 이는 예상한 동작이다.

## Issue grouping

동일한 개발 빌드에서 같은 처리되지 않은 오류를 반복 전송했을 때 기존 Issue의 발생 횟수가 증가했다. 처리된 예외도 같은 stack trace와 오류 제목을 가진 이벤트끼리 그룹화됐다.

Source map 미적용 빌드와 적용 빌드는 stack trace의 파일 위치가 달라 별도 Issue 그룹으로 만들어졌다. 따라서 Source map 도입 전후에는 같은 논리적 오류가 잠시 다른 Issue로 보일 수 있다.

## 이벤트에서 확인한 기본 정보

- `environment`: `local`
- `release`: 테스트에 사용한 빌드별 릴리스
- SDK: `sentry.javascript.react 10.72.0`
- 브라우저: Headless Chrome 151
- 운영체제 / 장치: macOS / Mac
- 요청 URL: 테스트 앱의 로컬 URL
- 사용자 ID, 이름, 이메일: 없음

SDK에서 `sendDefaultPii: false`를 설정했으며 이번 이벤트에 사용자 식별정보를 넣지 않았다. 서버 기본 데이터 정제도 동작해 Context에 넣은 `authentication_method` 값은 `[Filtered]`로 저장됐다. 다만 이 한 사례만으로 모든 개인정보가 자동 제거된다고 판단하면 안 되며, 전체 정제 정책은 Phase 7에서 별도로 검증한다.

## Breadcrumb, Tag, Context

API 404 이벤트에는 다음 정보가 함께 저장됐다.

- Fetch breadcrumb: `GET /api/sentry-poc/does-not-exist`, 상태 `404`
- `http_failure` Context: method, path, status

업무 Breadcrumb 이벤트에는 다음 세 단계가 시간순으로 저장됐다.

1. 송금 화면 진입
2. 금액 입력 완료 (`currency=KRW`)
3. 수취인 검증 실패 (`error_code=POC_RECIPIENT_INVALID`)

Tag/Context 이벤트에서는 `channel=hana-ez`, `service=remittance`, `page=transfer-review`, `test_case=tag-context`를 검색용 Tag로 확인했다. `api_status`, `process_step`, `retry_count`는 구조화된 `business_state` Context로 확인했다.

## Source map 전후 비교

### 1. 미적용 기준 이벤트

- 릴리스: `frontend-poc@0.1.0-no-sourcemap`
- 이벤트 ID: `898266be822b445d8e52b9fd5f0a19c2`
- 표시 위치: `/assets/index-CcFkWJqx.js:29:26924`
- 함수명: 축약되거나 없음

프로덕션 번들의 난독화된 위치만 표시돼 원본 TypeScript 코드를 바로 찾기 어렵다.

### 2. Debug ID 삽입과 업로드

`scripts/upload-test-app-sourcemaps.sh`는 다음 순서로 실행된다.

1. `vite build --sourcemap hidden`으로 프로덕션 빌드 생성
2. `sentry-cli sourcemaps inject`로 JavaScript와 map에 같은 Debug ID 삽입
3. `sentry-cli sourcemaps upload --validate`로 로컬 Sentry에 artifact bundle 업로드

검증에 사용한 Debug ID는 `2d9b8e84-cdbb-58c8-bbe0-4203bf6ba0ea`이며, 업로드된 JavaScript와 map에서 일치했다.

### 3. 적용 이벤트

- 릴리스: `frontend-poc@0.1.0-with-sourcemap`
- 이벤트 ID: `dc44ad9f95f44568843a5150d09396f2`
- 브라우저가 보낸 원시 위치: `/assets/index-DGEe9VKf.js:31:26926`
- Sentry 처리 후 원본 위치: `src/sentry/actions.ts:14:15`
- 원본 프레임: `inApp=true`

따라서 이 환경에서 Debug ID 기반 artifact bundle 업로드와 원본 TypeScript stack trace 복원이 실제로 동작한다.

Source map은 업로드 전에 이미 처리된 과거 이벤트를 소급 변환하지 않는다. 업로드 후 새 이벤트로 검증해야 한다.

## 운영 중 발견한 후처리 큐 장애

Source map 업로드 직전 Docker 내부에서 Kafka 연결이 일시적으로 끊긴 흔적이 있었다. Relay는 envelope에 HTTP 200을 반환했지만 새 오류가 Sentry API와 ClickHouse에 나타나지 않았다.

진단 결과는 다음과 같았다.

- `ingest-events` 지연: 0
- `taskworker` Kafka 그룹: 활성 소비자 없음
- 대기 작업: 1,156건
- `taskbroker` 로그: Kafka 연결 거부 후 파티션 반납, 이후 재등록 실패

데이터 볼륨을 삭제하지 않고 `taskworker`, `taskbroker` 컨테이너만 순서대로 재시작했다. 이후 소비자가 다시 등록됐고 대기 작업은 12건까지 즉시 감소한 뒤 이벤트 처리가 재개됐다. 재시작 전에 반드시 서비스 상태와 로그, Kafka lag를 확인해야 하며 `docker compose down -v`는 사용하지 않는다.

이 사례는 Self-hosted Sentry에서 HTTP 200만으로 최종 저장을 보장할 수 없고, Relay 이후의 Kafka·taskbroker·taskworker·Snuba 경로도 관찰해야 함을 보여 준다.

## 판정

### 성공

- 6종 오류/메시지 이벤트와 1종 성능 작업 수집
- 오류 grouping과 발생 횟수 증가
- 브라우저, OS, URL, environment, release 확인
- Fetch 및 업무 Breadcrumb 확인
- Tag와 Context 확인
- 사용자 지정 느린 작업과 소요 시간 확인
- Debug ID 기반 Source map 업로드와 원본 TypeScript 프레임 복원
- 후처리 큐 장애 진단 및 데이터 손실 없는 서비스 복구

### 실패

- 기능 검증 실패 없음

### 추가 확인

- 설치된 `sentry-cli 3.7.0`에는 `sourcemaps explain` 명령이 없어 이벤트 API로 결과를 교차 검증했다.
- 로그인된 Chrome을 자동 제어하는 플러그인 초기화 오류로 Sentry 상세 화면의 자동 탐색은 수행하지 못했다. 이벤트 API와 내부 저장소 검증은 성공했으며 상세 이벤트 URL은 수동 확인용으로 연다.
- Phase 6에서 성능 화면의 검색·대시보드 지원 범위를 추가 검증한다.
- Phase 7에서 개인정보·금융정보 정제 정책을 공격적인 테스트 데이터로 검증한다.

## 토큰 관리

Source map 업로드 토큰은 `test-app/.env.sentry-build-plugin`에만 있고 `.gitignore`로 제외된다. 저장소에는 토큰을 넣지 않는다. 회사 환경에서는 CI/CD의 Secret 저장소를 사용하고 Project/Release 업로드에 필요한 최소 권한만 부여한다. PoC 업로드를 더 하지 않을 경우 Sentry의 Custom Integration 화면에서 토큰을 폐기할 수 있다.

## 공식 참고 자료

- [Sentry React Source Maps](https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/)
- [Sentry Source Map Troubleshooting](https://docs.sentry.io/platforms/javascript/guides/hono/sourcemaps/troubleshooting_js)
- [Sentry API Authentication](https://docs.sentry.io/api/auth/)
- [Sentry API Permissions](https://docs.sentry.io/api/permissions/)
