# 다른 프론트엔드 프로젝트 적용 Quick Guide

## 목표

다른 React 개발자가 이 PoC와 같은 방식으로 망 내부 Sentry에 연결할 때 수정할 파일과 책임을 빠르게 찾기 위한 문서다. 예시는 Vite + React + TypeScript 기준이며, 원본 개인정보와 인증정보를 Sentry에 보내지 않는 것을 기본값으로 한다.

처음에는 오류, Source map, Breadcrumb, Trace, Web Vitals까지만 적용한다. Logs, 가입 퍼널, Replay, 사용자 기준 지표는 각 gate를 통과한 뒤 순서대로 켠다.

## 이 PoC에서 복사할 파일

| 목적 | 현재 파일 | 다른 프로젝트에서 할 일 |
| --- | --- | --- |
| SDK 초기화 | `test-app/src/sentry/client.ts` | 앱의 가장 이른 entry에서 import |
| 개인정보 정제 | `test-app/src/security/securityPolicy.core.ts` | 조직 공통 패키지로 복사하고 서비스별 민감 키 추가 |
| 정제 단위 테스트 | `test-app/src/security/securityPolicy.core.test.ts` | 실제 서비스 fixture 추가 |
| 기본 오류·Span 예시 | `test-app/src/sentry/actions.ts` | 공통 helper 또는 각 Error Boundary/API 계층에서 호출 |
| Tag·Context 계약 | `test-app/src/custom-data/customData.core.ts` | 공통 taxonomy에 맞게 옵션을 제한 |
| 업무 이벤트 전송 | `test-app/src/custom-data/useCustomDataTest.ts` | 테스트 UI가 아니라 실제 domain hook/service에 통합 |
| 앱 entry | `test-app/src/main.tsx` | React import와 render보다 먼저 Sentry client import |
| 환경변수 예시 | `test-app/.env.example` | 사내 DSN, environment, release 변수만 템플릿화 |
| Source map | `scripts/upload-test-app-sourcemaps.sh` | 프로젝트 빌드 명령과 release 이름에 맞게 복제 |
| Dashboard 정의 | `scripts/phase6-dashboards.json` | project ID와 서비스 taxonomy 변경 |
| Dashboard 생성 | `scripts/create-phase6-dashboards.sh` | 조직 slug와 내부 Sentry URL 설정 |
| 서버 개인정보 설정 | `scripts/configure-phase7-data-scrubbing.sh` | Sentry 관리자만 신규 Project마다 실행 |
| 실제 저장 검증 | `scripts/verify-phase7-data-scrubbing.sh` | SDK/Relay/Sentry 업데이트 때 반복 |

## 권장 신규 파일 구조

PoC 코드를 제품 코드에 그대로 흩어놓지 말고 다음처럼 observability 경계를 만든다.

```text
src/
  observability/
    sentry.client.ts        # Sentry.init 한 곳
    privacy.ts              # beforeSend/beforeBreadcrumb/beforeSendLog
    taxonomy.ts             # service/page/flow/error code 허용 목록과 타입
    errors.ts               # captureException/captureMessage helper
    flow.ts                 # 가입 단계 entered/completed/failed 기록
    performance.ts          # custom Span helper
    identity.ts             # 가명 ID gate; 기본 구현은 setUser(null)
    replay.ts               # 승인 환경과 block selector만 관리
    __tests__/
      privacy.test.ts
      taxonomy.test.ts
      flow.test.ts
```

여러 프론트엔드가 있다면 `privacy.ts`, `taxonomy.ts`, 공통 초기화 builder를 사내 패키지로 배포한다. 각 앱이 정제 로직을 복사해 서로 다르게 진화하지 않게 한다.

## 1. Sentry Project와 DSN 준비

독립 배포 서비스라면 Sentry에서 Project를 새로 만들고 DSN을 발급한다. Project 이름은 소스 저장소와 배포 단위를 반영한다.

```text
권장: customer-web, remittance-webview, membership-web
비권장: frontend1, test2, app-new
```

DSN은 이벤트 수집 주소이므로 브라우저 bundle에 포함될 수 있지만, 인증 토큰이 아니다. 반면 `SENTRY_AUTH_TOKEN`은 release/Source map 업로드 권한이 있으므로 절대 브라우저 환경변수나 Git에 넣지 않는다.

환경 템플릿:

```dotenv
VITE_SENTRY_DSN=http://PUBLIC_KEY@sentry.internal/PROJECT_ID
VITE_SENTRY_ENABLED=true
VITE_SENTRY_ENVIRONMENT=production
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_APP_RELEASE=membership-web@GIT_SHA

# 보안 승인 전 기본값
VITE_SENTRY_LOGS_ENABLED=false
VITE_SENTRY_REPLAY_ENABLED=false
VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0
VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=0
```

실제 `.env`와 `.env.sentry-build-plugin`은 `.gitignore`에 넣는다.

## 2. 패키지 설치

폐쇄망 반입 절차를 거친 사내 npm registry 또는 offline store에서 고정 버전을 설치한다.

```bash
pnpm add @sentry/react@10.72.0
pnpm add -D @sentry/cli@3.7.0
```

회사 표준 버전은 서버 버전과 별도로 lockfile, SBOM, 취약점 검토를 거쳐 관리한다. 인터넷의 `latest`를 폐쇄망 빌드 때 직접 받지 않는다.

## 3. SDK를 가장 먼저 초기화

`src/observability/sentry.client.ts`를 만들고 `src/main.tsx` 첫 줄에서 import한다.

```ts
// src/main.tsx
import "./observability/sentry.client";
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
```

초기화 기준안:

```ts
// src/observability/sentry.client.ts
import * as Sentry from "@sentry/react";
import {
  sanitizeBreadcrumb,
  sanitizeErrorEvent,
  sanitizeLog,
} from "./privacy";

const dsn = import.meta.env.VITE_SENTRY_DSN?.trim() ?? "";
const enabled =
  dsn.length > 0 &&
  import.meta.env.VITE_SENTRY_ENABLED?.trim().toLowerCase() !== "false";
const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || "local";
const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0);
const logsEnabled = import.meta.env.VITE_SENTRY_LOGS_ENABLED === "true";

if (enabled) {
  Sentry.init({
    dsn,
    environment,
    release: import.meta.env.VITE_APP_RELEASE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate,
    sendDefaultPii: false,
    enableLogs: logsEnabled,
    beforeSend: sanitizeErrorEvent,
    beforeSendLog: sanitizeLog,
    beforeBreadcrumb: sanitizeBreadcrumb,
    tracePropagationTargets: [/^https:\/\/api\.internal\//, /^\//],
  });
}
```

`Number()` 결과가 `NaN`이거나 0~1 밖일 때 환경별 안전 기본값으로 대체하는 검증을 넣는다. 이 PoC의 `buildCollectionPolicy()`를 재사용하면 된다.

## 4. 개인정보 정제 정책 적용

`test-app/src/security/securityPolicy.core.ts`를 `src/observability/privacy.ts`로 옮긴 뒤 다음 규칙을 유지한다.

- `sendDefaultPii: false`
- URL query와 fragment 제거
- request/response body와 전체 headers 제거
- 이름, 전화, 이메일, 계좌, 주민번호, CI, OTP, token, cookie 제거
- console breadcrumb와 입력 변경 breadcrumb 제거
- 오류 message에 들어간 알려진 민감 패턴 치환
- `extra`, Context, Breadcrumb data 재귀 정제
- Logs는 허용된 키만 남기는 allowlist 방식 사용

`beforeSend`만 믿지 않는다. 서버 관리자는 새 Project에도 [Phase 7 설정 스크립트](../scripts/configure-phase7-data-scrubbing.sh)를 적용하고 서버 단독 probe를 통과시킨다.

Logs 정제는 오류 이벤트와 별도 hook이라는 점에 주의한다. 최소 예시는 다음과 같다.

```ts
const allowedLogAttributes = new Set([
  "service",
  "page",
  "flow_name",
  "flow_step",
  "transition",
  "outcome",
  "error_code",
]);

export function sanitizeLog(log: Sentry.Log): Sentry.Log | null {
  if (!isAllowedFixedMessage(log.body)) return null;

  return {
    ...log,
    attributes: Object.fromEntries(
      Object.entries(log.attributes ?? {}).filter(([key]) =>
        allowedLogAttributes.has(key),
      ),
    ),
  };
}
```

SDK의 실제 `Log` 타입 export는 적용 버전에서 typecheck로 확인한다. 타입 경로가 다르면 SDK가 넘겨주는 callback parameter에서 추론하고 `any`로 우회하지 않는다.

## 5. 공통 taxonomy를 타입으로 고정

`src/observability/taxonomy.ts`:

```ts
export const services = ["membership", "remittance", "payment"] as const;
export const signupSteps = [
  "terms",
  "account-verification",
  "phone-verification",
  "cdd",
  "complete",
] as const;
export const transitions = ["entered", "completed", "failed", "abandoned"] as const;

export type Service = (typeof services)[number];
export type SignupStep = (typeof signupSteps)[number];
export type FlowTransition = (typeof transitions)[number];

export interface SafeDebugTags {
  service: Service;
  page: string;
  flow_name?: "member-signup";
  flow_step?: SignupStep;
  transition?: FlowTransition;
  error_code?: string;
}
```

런타임에서도 `page`는 `/^[a-z0-9-]+$/`, `error_code`는 `/^[A-Z0-9_]+$/`처럼 검증한다. TypeScript 타입만으로 서버에서 들어온 자유 문자열을 안전하게 만들 수 없다.

## 6. 오류 helper 연결

Error Boundary, API client, 업무 실패 처리에서 한 가지 공통 함수를 호출한다.

```ts
// src/observability/errors.ts
import * as Sentry from "@sentry/react";
import type {SafeDebugTags} from "./taxonomy";

export function reportFrontendError(
  error: unknown,
  tags: SafeDebugTags,
  safeContext?: Record<string, string | number | boolean>,
) {
  const normalized = error instanceof Error ? error : new Error("UNKNOWN_FRONTEND_ERROR");

  return Sentry.withScope(scope => {
    scope.setTags(tags);
    if (safeContext) scope.setContext("safe_business_state", safeContext);
    return Sentry.captureException(normalized);
  });
}
```

오류 message는 `전화번호 010-... 인증 실패`가 아니라 `PHONE_VERIFICATION_FAILED`처럼 고정한다. 원본 서버 오류 body를 `Error` 생성자에 넣지 않는다.

## 7. 화면·업무 Breadcrumb 연결

화면 전환과 중요한 상태 변화만 남긴다.

```ts
Sentry.addBreadcrumb({
  category: "signup.flow",
  message: "signup step entered",
  level: "info",
  data: {
    flow_step: "phone-verification",
    page: "signup-phone",
  },
});
```

다음 데이터는 넣지 않는다.

- form state 전체
- 입력한 휴대폰 번호, 계좌번호, CDD 답변
- OTP, token, cookie
- request/response body
- URL query string

## 8. 가입 플로우 계측

`src/observability/flow.ts`에 한 가지 API를 만든다.

```ts
import * as Sentry from "@sentry/react";
import type {FlowTransition, SignupStep} from "./taxonomy";

interface SignupFlowEvent {
  step: SignupStep;
  transition: FlowTransition;
  page: string;
  outcome: "success" | "failure" | "cancel" | "timeout";
  errorCode?: string;
}

export function recordSignupFlow(event: SignupFlowEvent) {
  Sentry.logger.info("signup.flow.transition", {
    service: "membership",
    flow_name: "member-signup",
    flow_step: event.step,
    transition: event.transition,
    page: event.page,
    outcome: event.outcome,
    ...(event.errorCode ? {error_code: event.errorCode} : {}),
  });

  Sentry.addBreadcrumb({
    category: "signup.flow",
    message: `signup ${event.transition}`,
    data: {flow_step: event.step, page: event.page, outcome: event.outcome},
  });
}
```

호출 위치:

- `entered`: React 화면이 실제 표시된 뒤 한 번. StrictMode 중복과 back navigation을 처리한다.
- `completed`: 프론트 버튼 클릭이 아니라 백엔드 성공 응답 후.
- `failed`: 정규화된 실패 코드가 확정된 위치.
- `abandoned`: 브라우저 `beforeunload` 추측보다 백엔드의 가입 시도 timeout job이 공식 기록.

공식 퍼널 이벤트는 백엔드/분석계에도 기록한다. Sentry Log만으로 사용자 기준 이탈률 원장을 만들지 않는다.

## 9. 특정 사용자 상관관계

기본 구현은 사용자를 비운다.

```ts
// src/observability/identity.ts
import * as Sentry from "@sentry/react";

export function clearDebugIdentity() {
  Sentry.setUser(null);
}
```

원본 UUID, 이메일, 전화번호를 `setUser`나 Tag에 넣지 않는다. 사용자 기준 지표가 승인되면 인증 백엔드가 발급한 `debug_subject_id`만 받는다.

```ts
export function setApprovedDebugIdentity(debugSubjectId: string) {
  if (!/^dbg_v\d_[A-Za-z0-9_-]{20,80}$/.test(debugSubjectId)) {
    throw new Error("INVALID_DEBUG_SUBJECT_ID");
  }
  Sentry.setUser({id: debugSubjectId});
}
```

이 코드만 추가하면 완료가 아니다. Relay의 `$user.id` 제거 규칙, 매핑 저장소, 보관기간, 접근권한, 원본 UUID 차단 probe가 함께 승인돼야 한다. HMAC 비밀키를 브라우저 bundle에 넣지 않는다.

## 10. 성능과 Web Vitals

자동 페이지 성능은 `browserTracingIntegration()`이 담당한다. 업무상 느린 작업은 고정 이름 custom Span으로 감싼다.

```ts
await Sentry.startSpan(
  {
    name: "signup.phone-verification",
    op: "ui.signup.step",
    attributes: {
      "app.service": "membership",
      "app.page": "signup-phone",
      "app.flow_step": "phone-verification",
    },
  },
  () => verifyPhoneWithoutSensitiveArguments(),
);
```

동적 UUID나 URL 전체를 span name으로 만들지 않는다. React Router를 사용하는 앱은 해당 SDK 버전의 router instrumentation을 추가하고 route 이름을 template으로 정규화한다.

내부 API까지 Trace를 연결할 경우:

1. 프론트 `tracePropagationTargets`에 정확한 내부 origin만 추가한다.
2. API CORS에서 `sentry-trace`, `baggage`를 허용한다.
3. 백엔드 Sentry SDK에서도 같은 Trace를 이어받는다.
4. 실제 브라우저 요청과 Sentry Trace 화면에서 연결을 검증한다.

## 11. Replay는 승인 후 별도 변경

승인 전에는 현재 PoC처럼 integration 자체를 등록하지 않고 두 표본율을 0으로 유지한다. 승인 후 `src/observability/replay.ts`에서만 정책을 만든다.

```ts
export function buildApprovedReplayIntegration() {
  return Sentry.replayIntegration({
    maskAllText: true,
    maskAllInputs: true,
    blockAllMedia: true,
    block: [
      "[data-sentry-block]",
      ".account-verification-screen",
      ".phone-verification-screen",
      ".cdd-screen",
      ".secure-keypad",
    ],
    networkDetailAllowUrls: [],
    networkCaptureBodies: false,
  });
}
```

민감 화면 root에도 방어 표식을 둔다.

```tsx
<main className="cdd-screen" data-sentry-block>
  <CddForm />
</main>
```

활성화 순서:

1. local 합성 데이터, 오류 세션 100%로 기능만 검증
2. Replay recording 저장본에서 합성 민감값 0건 확인
3. 사내 QA 기기에서 CPU·메모리·전송량 확인
4. production 오류 세션 1~5%, 정상 세션 0%로 시작
5. 보관량과 열람 감사를 보고 점진 조정

`unmask`, `unblock`, network allow URL을 제품 개발자가 편의상 추가하지 못하도록 공통 모듈과 코드 소유권 규칙을 둔다.

## 12. Source map과 release

SDK 초기화의 release와 Source map 업로드 release는 한 글자까지 같아야 한다. 이 PoC 방식:

```bash
VITE_APP_RELEASE="membership-web@${GIT_COMMIT_SHA}" pnpm build
sentry-cli sourcemaps inject dist
sentry-cli sourcemaps upload \
  --url http://sentry.internal \
  --org sentry \
  --project membership-web \
  --validate \
  dist
```

실제 token은 CI secret에서 `SENTRY_AUTH_TOKEN`으로 주입한다. log에 token을 출력하지 않는다. hidden source map을 사용하거나 업로드 후 `.map`을 배포 artifact에서 삭제한다.

검증:

1. production 방식으로 고정 테스트 오류 발생
2. Issue event release 확인
3. stack이 원본 TSX 파일과 줄을 가리키는지 확인
4. Project Settings > Source Maps에서 artifact bundle 확인

## 13. Dashboard 복제

`scripts/phase6-dashboards.json`을 복사하고 다음을 바꾼다.

- `projects`: 새 Sentry project ID
- title: 서비스 이름 포함
- 기본 `period`: 운영 합의에 맞게 7d 또는 14d
- `service`, `page`, `flow_step`, `error_code`: 공통 taxonomy와 일치
- Web Vitals: `count()`와 p75를 함께 유지

생성 전에 반드시 validate API를 통과시킨다. 이 PoC는 `scripts/create-phase6-dashboards.sh`가 `validateOnly=1`을 먼저 호출한다.

권장 대시보드 세트:

```text
1. Frontend Stability
   Total Errors, Unresolved Issues, New/Resolved, Errors by Release/Browser

2. Business Error Breakdown
   Errors by Service/Page/Flow Step/Error Code/Channel

3. Frontend Performance
   Pageload avg/p95, Web Vitals p75, Performance Score, sample count

4. Signup Diagnostics
   entered/completed/failed event counts by step
   "운영 진단용 근사치" 라벨 필수
```

사용자 기준 이탈률과 오류 영향 사용자율은 Sentry에 정상 사용자 분모와 승인된 가명 ID가 들어오기 전에는 만들지 않는다.

## 14. 알림 기본안

알림은 처음부터 많이 만들지 말고 다음 네 가지로 시작한다.

| 알림 | 조건 예시 | 담당 |
| --- | --- | --- |
| 신규 production Issue | 새 Issue + production | 해당 Project 팀 |
| 핵심 flow 실패 급증 | service/flow_step/error_code + 임계치 | 프론트 + 업무 백엔드 |
| 오류량 급증 | baseline 대비 증가 | 온콜 팀 |
| Web Vital 악화 | 핵심 page의 p75/score 임계치 | 프론트 성능 담당 |

폐쇄망에서는 사내 SMTP 또는 내부 webhook만 사용한다. 외부 URL로 notification을 내보내지 않는다.

## 15. 필수 테스트

### 단위 테스트

- 각 민감 key가 object 깊이에 관계없이 제거되는가
- 오류 message와 URL query의 민감 패턴이 제거되는가
- console/input breadcrumb가 폐기되는가
- Logs의 미승인 message/attribute가 폐기되는가
- taxonomy 이외의 service/page/error code가 거부되는가
- 환경별 sample rate가 0~1 범위인가

### 통합 테스트

- handled/unhandled 오류 최종 저장 확인
- Tag 검색과 Context 상세 표시 확인
- Source map 원본 stack 확인
- custom Span과 Web Vitals 확인
- Sentry 중단 시 앱 기능이 정상이고 전송 실패가 사용자 흐름을 막지 않는지 확인

### 보안 probe

- SDK 정제를 통과한 이벤트에 합성 원문 0건
- SDK를 우회해 Relay에 직접 보낸 이벤트에 합성 원문 0건
- 신규 Project와 업그레이드 뒤 다시 실행
- Replay를 켰다면 DOM, 입력, media, network, recording segment 전용 probe 추가
- 가명 ID를 켰다면 승인 형식만 남고 원본 UUID는 제거되는지 확인

## 16. 적용 완료 명령

이 PoC 자체를 변경한 경우 최소 다음을 실행한다.

```bash
pnpm --dir test-app typecheck
pnpm --dir test-app lint
pnpm --dir test-app test -- --run
pnpm --dir test-app build

./scripts/sentry.sh health
./scripts/verify-phase7-data-scrubbing.sh
./scripts/verify-phase7-data-scrubbing.sh --server-probe
```

Replay와 Logs를 켜는 변경은 위 명령만으로 완료 처리하지 않는다. 각각 실제 저장 API/화면과 별도 합성 개인정보 probe까지 확인한다.

## 코드 리뷰 체크리스트

- [ ] Sentry 초기화가 앱 entry보다 먼저 실행된다.
- [ ] DSN과 auth token을 혼동하지 않았다.
- [ ] release가 SDK, build, Source map에서 일치한다.
- [ ] service/page/flow/error code가 공통 taxonomy에 있다.
- [ ] 오류 message에 자유 입력이나 서버 body를 넣지 않았다.
- [ ] 사용자 UUID, email, phone, account를 Tag/Context/Breadcrumb/Log에 넣지 않았다.
- [ ] `beforeSend`, `beforeBreadcrumb`, `beforeSendLog` 테스트가 있다.
- [ ] 내부 API origin만 `tracePropagationTargets`에 있다.
- [ ] Web Vitals는 표본 수와 p75를 함께 본다.
- [ ] 퍼널 수치가 이벤트 기준인지 사용자 기준인지 명시했다.
- [ ] Replay 기본값이 OFF이고 승인·probe 없이 켤 수 없다.
- [ ] 개인정보 조회는 Sentry 밖의 JIT 게이트를 사용한다.

## 역할별 책임

| 역할 | 책임 |
| --- | --- |
| 프론트 개발자 | 오류·Breadcrumb·Span 계측, taxonomy 준수, 민감 원문 미전송 |
| 업무 백엔드 | 단계 완료/이탈의 authoritative event, 가명 ID 발급 시 비밀키 보호 |
| Sentry 관리자 | Project/DSN, Relay 정제, 보관기간, Dashboard, Alert |
| 보안·개인정보 담당 | Replay/가명 ID/조회 게이트 승인, 감사 기준과 probe 검토 |
| 플랫폼·인프라 | 폐쇄망 반입, 백업/복구, 용량, Kafka/ClickHouse/호스트 관제 |
| 데이터 담당 | 공식 퍼널 분모·중복제거·기간 정의, BI/Grafana 제공 |

## 관련 문서

- [기능별 설계와 판정](10-frontend-observability-design.md)
- [화면 주소와 사용법](11-frontend-debugging-guide.md)
- [React SDK와 테스트 이벤트](04-sdk-and-events.md)
- [커스텀 데이터 수집](05-custom-data.md)
- [Dashboard 정의와 한계](06-dashboards.md)
- [개인정보와 실제 저장 검증](07-security.md)
- [회사 적용 가이드](09-company-adoption.md)
