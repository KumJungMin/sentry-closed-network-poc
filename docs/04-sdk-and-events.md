# Phase 3: React SDK와 테스트 이벤트

- 작성일: 2026-08-30 (Asia/Seoul)
- 앱: React 19.2.8 + TypeScript 5.9.3 + Vite 8.2.2
- Sentry SDK: `@sentry/react` 10.72.0
- 프로젝트: `frontend-poc`
- 앱 주소: `http://127.0.0.1:5173/`
- Sentry 주소: `http://127.0.0.1:9000/`

## 이번 Phase의 목표

서로 다른 Sentry 기능을 한 화면에서 하나씩 실행할 수 있는 학습용 React 앱을 만든다. 이번 Phase에서는 앱과 SDK 호출을 구현하고 자동 테스트와 브라우저 렌더링을 검증한다. 이벤트가 Sentry 저장소까지 도착해 어떻게 보이는지는 Phase 4에서 버튼별로 검증한다.

## SDK 초기화

SDK는 앱 렌더링 전에 `src/sentry/client.ts`에서 초기화한다.

```ts
Sentry.init({
  dsn,
  environment: "local",
  release: "frontend-poc@0.1.0",
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 1.0,
  sendDefaultPii: false,
});
```

- `dsn`: 브라우저 SDK가 어느 Sentry 프로젝트로 보낼지 알려주는 주소다. 실제 값은 Git에서 제외된 `.env.local`에만 있다.
- `environment`: 같은 오류를 local, SIT, UAT, production처럼 환경별로 구분한다.
- `release`: 어느 앱 버전에서 오류가 발생했는지 구분한다.
- `browserTracingIntegration`: 페이지 로드와 브라우저 작업의 성능 추적 기반을 추가한다.
- `tracesSampleRate: 1.0`: PoC에서는 모든 성능 샘플을 전송한다. 운영에서는 데이터량과 비용을 고려해 낮춰야 한다.
- `sendDefaultPii: false`: SDK에 기본 개인정보 전송을 요청하지 않는다. 완전한 정제 정책은 Phase 7에서 검증한다.

Session Replay, Logs, Application Metrics는 이번 Phase에서 켜지 않았다.

## 일곱 가지 테스트

| 번호 | 화면 동작 | Sentry 기능 | 기대 결과 |
| ---: | --- | --- | --- |
| 1 | 일반 JavaScript 오류 | 전역 오류 자동 수집 | 처리되지 않은 예외와 브라우저 stack trace |
| 2 | 처리된 오류 전송 | `captureException` | 앱이 처리한 `Error`를 명시적인 이벤트로 수집 |
| 3 | 업무 오류 메시지 | `captureMessage` | 예외 객체 없이 warning 레벨 메시지 수집 |
| 4 | 존재하지 않는 API 호출 | Fetch breadcrumb + `captureException` | HTTP 실패와 정제된 요청 상태 수집 |
| 5 | Breadcrumb 후 오류 | `addBreadcrumb` | 오류 전 송금 흐름 세 단계를 시간순으로 표시 |
| 6 | Tag와 Context 후 오류 | `setTags`, `setContext` | 검색 후보와 상세 분석 데이터를 분리해 표시 |
| 7 | 느린 작업 측정 | `startSpan` | 약 1.2초의 `poc.slow-operation` 성능 Span |

### Exception과 Message

- Exception은 `Error` 객체와 stack trace를 가지므로 코드 오류 분석에 적합하다.
- Message는 예외가 아니지만 관찰할 가치가 있는 업무 경고나 상태를 기록할 때 적합하다.

### Breadcrumb

Breadcrumb는 오류 그 자체가 아니라 오류 전에 무슨 일이 있었는지 보여주는 작은 흔적이다. 테스트 앱은 가짜 송금 흐름만 사용하며 이름, 계좌번호, 인증번호 같은 실제 값은 넣지 않는다.

### Tag와 Context

- Tag는 짧고 반복되는 값에 적합하며 검색과 집계 후보로 사용한다.
- Context는 한 이벤트의 상세 분석을 돕는 구조화 데이터다.
- 테스트별 `withScope` 안에서만 값을 설정해 다음 이벤트로 섞이지 않도록 했다.

### Transaction과 Span

Transaction은 한 작업 전체이고 Span은 그 안의 세부 작업이다. 최신 JavaScript SDK의 `startSpan` API로 느린 사용자 지정 작업을 측정한다. 실제 Self-hosted 화면에서 검색·표시되는 범위는 Phase 4에서 확인한다.

## 환경 파일

공유 가능한 예시는 `test-app/.env.example`이다.

```dotenv
VITE_SENTRY_DSN=http://PUBLIC_KEY@127.0.0.1:9000/PROJECT_ID
VITE_SENTRY_ENVIRONMENT=local
VITE_APP_RELEASE=frontend-poc@0.1.0
```

실제 값은 `test-app/.env.local`에 있으며 루트 `.gitignore` 규칙으로 제외된다. Vite의 `VITE_` 변수는 브라우저 번들에 포함되므로 비밀번호나 인증 토큰을 넣으면 안 된다.

## 실행과 종료

프로젝트 루트에서 실행한다.

```bash
pnpm --dir test-app dev
```

브라우저에서 `http://127.0.0.1:5173/`을 연다. 개발 서버 종료는 실행한 터미널에서 `Ctrl+C`를 누른다. Sentry 서버는 별도 프로세스이므로 테스트 앱 종료의 영향을 받지 않는다.

## 구현 검증 결과

| 검증 | 결과 |
| --- | --- |
| ESLint | 성공 |
| TypeScript typecheck | 성공 |
| Vitest | 3개 파일, 13개 테스트 성공 |
| Production build | 성공 |
| 데스크톱 브라우저 | 내용 렌더링, 오류 오버레이 없음, 7개 버튼 확인 |
| 모바일 390px | 한 열 레이아웃, 7개 버튼, 최근 결과 영역 확인 |
| 브라우저 오류 목록 | 없음 |
| Git 비밀값 검사 | 실제 `.env.local` 제외 확인 |

Production build 결과 JavaScript는 약 345KB, gzip 기준 약 112KB다. PoC이므로 번들 최적화보다 기능 분리를 우선했다.

## 리뷰 결과

- 컨벤션 검사: 계획된 `components/`, `sentry/`, 인접 테스트 배치와 이름 규칙을 준수했다.
- React 리뷰: Hook 규칙 위반, 렌더 부작용, 불필요한 Effect나 memoization이 없다.
- 리뷰 반영: 비동기 테스트 중 다른 버튼도 비활성화해 한 번에 하나만 실행되도록 했다.
- 테스트 보강: SDK 미연결, API 네트워크 실패, action 실패 상태를 추가했다.
- 시각 보강: 모바일에서 한국어 제목이 글자 중간에 끊기지 않도록 처리했다.

## Phase 4에서 확인할 내용

이번 Phase에서는 테스트 버튼을 자동으로 누르지 않았다. 다음 Phase에서 각 버튼을 하나씩 실행하며 다음을 Sentry UI에서 확인한다.

- Issue 생성과 grouping
- stack trace와 파일 위치
- 브라우저, 운영체제, URL
- environment와 release
- Fetch breadcrumb와 업무 breadcrumb
- Tag와 Context 표시 차이
- 성능 Span 표시
- Source map 적용 전후 차이

위 항목의 실제 검증 결과는 [Phase 4: 기본 데이터 수집과 Source map 검증](05-basic-collection.md)에 기록했다.

## 공식 참고 자료

- [Sentry React SDK 문서](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry 이벤트 보강 개요](https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/)
- [Sentry Breadcrumb 문서](https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/breadcrumbs/)
- [Sentry 사용자 지정 계측 문서](https://docs.sentry.io/platforms/javascript/guides/react/tracing/instrumentation/custom-instrumentation/)
