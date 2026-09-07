# 다른 프론트엔드 프로젝트 적용 Quick Guide

## 적용 원칙

다른 React/TypeScript 개발자가 같은 기능을 옮길 때 Sentry SDK 코드만 복사하면 안 된다. `SDK 최소수집`, `Relay 서버 방어`, `내부 모수 분석`, `JIT 조회 게이트`의 네 경계를 함께 적용한다.

권장 런타임은 Node 20.19+ 또는 22.12+다. Self-hosted Sentry 버전이 다르면 Dashboard field, API route, Replay 기능을 `validateOnly`와 합성 저장 probe로 다시 확인한다.

## 파일별 복사·수정 지도

| 이 PoC 파일 | 대상 프로젝트에서 수정할 것 |
| --- | --- |
| `test-app/src/sentry/client.ts` | DSN/env/release, 내부 API trace origin |
| `test-app/src/sentry/replay.ts` | 민감 UI의 block selector, 표본율 정책 |
| `test-app/src/security/securityPolicy.core.ts` | 사내 민감 key allow/deny 정책, 승인 가명 ID 형식 |
| `test-app/src/sentry/logging.ts` | 고정 message taxonomy, service/page/error_code |
| `test-app/src/signup-funnel/funnel.core.ts` | 실제 가입 단계와 완료 정의 |
| `test-app/src/signup-funnel/funnelApi.ts` | 내부 분석 API 주소와 인증 |
| `test-app/src/identity/identityApi.ts` | 사내 HMAC/매핑 API와 사용자 scope 연결 |
| `test-app/src/privacy/privacyApi.ts` | SSO/MFA/JIT backend contract |
| `test-app/src/analytics/usageApi.ts` | 실제 활성 사용자·오류 numerator backend |
| `internal-observability/*.mjs` | PoC 합성 adapter를 운영 DB/KMS/감사 저장소로 교체 |
| `scripts/service-projects.json` | 회사 서비스명과 project slug |
| `scripts/phase7-*.json` | 보안 승인 민감 필드와 Relay selector |
| `scripts/phase6-dashboards.json` | 대상 project ID와 taxonomy |
| `browser-extension/dictionary.js` | 회사가 자주 쓰는 Sentry 고정 문구 |

## 1. Sentry 프로젝트와 환경변수

서비스별 독립 배포라면 프로젝트/DSN을 분리하고, 하나의 SPA 안 업무 영역은 `service` Tag로 나눈다.

```dotenv
VITE_SENTRY_DSN=http://PUBLIC_KEY@sentry.internal/PROJECT_ID
VITE_SENTRY_ENABLED=true
VITE_SENTRY_BASE_URL=http://sentry.internal
VITE_SENTRY_ORG=my-org
VITE_SENTRY_PROJECT_ID=123
VITE_SENTRY_ENVIRONMENT=production
VITE_APP_RELEASE=my-frontend@GIT_SHA
VITE_SENTRY_TRACES_SAMPLE_RATE=0.1
VITE_SENTRY_LOGS_ENABLED=true

# production은 승인 후 명시적으로 ON
VITE_SENTRY_REPLAY_ENABLED=false
VITE_SENTRY_REPLAY_SESSION_SAMPLE_RATE=0
VITE_SENTRY_REPLAY_ON_ERROR_SAMPLE_RATE=0.05
```

DSN은 브라우저 공개키이지만 저장소별 환경값으로 관리한다. API auth token, source map token, HMAC secret, JIT session secret은 절대 `VITE_*`에 두지 않는다.

## 2. 패키지와 초기화

```bash
pnpm add @sentry/react react-router-dom
```

애플리케이션 render보다 먼저 `sentry/client.ts`를 import한다. 필수 옵션은 다음과 같다.

```ts
import * as Sentry from "@sentry/react";
import { useEffect } from "react";
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from "react-router-dom";

Sentry.init({
  dsn,
  environment,
  release,
  enableLogs: true,
  integrations: [
    Sentry.reactRouterBrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    ...(replayEnabled ? [createReplayIntegration()] : []),
  ],
  tracesSampleRate,
  replaysSessionSampleRate,
  replaysOnErrorSampleRate,
  sendDefaultPii: false,
  beforeSend: sanitizeSentryEvent,
  beforeBreadcrumb: sanitizeSentryBreadcrumb,
  tracePropagationTargets: ["api.internal.example", /^\//],
});
```

`tracePropagationTargets`에 모든 origin을 넣지 않는다. 인증 header/body는 trace와 별개로 수집하지 않는다.

`Routes`는 `Sentry.wrapReactRouterRouting(Routes)`로 감싸고 앱 root는 `BrowserRouter` 안에서 렌더링한다. `/`를 기본 기능 경로로 바꿔야 한다면 Sentry 초기화 import보다 먼저 `history.replaceState`를 실행해 최초 pageload도 실제 경로로 기록한다. 운영 웹 서버에는 각 직접 URL이 `index.html`로 이어지는 SPA fallback을 설정한다.

## 3. Replay 개인정보 정책

`replay.ts`의 보수적 기본값을 유지한다.

```ts
Sentry.replayIntegration({
  maskAllText: true,
  maskAllInputs: true,
  blockAllMedia: true,
  block: ["[data-sentry-block]", "[data-private]"],
  networkDetailAllowUrls: [],
  networkCaptureBodies: false,
});
```

인증, 계좌, CDD, 개인정보 조회 root에 `data-private`를 붙인다. 운영 활성화 전 합성 Replay 저장본을 직접 재생해 원문 0건을 확인한다.

## 4. 오류와 구조화 Logs 연결

자유 문자열 대신 안정적인 message와 낮은 cardinality attribute를 사용한다.

```ts
Sentry.logger.error("frontend_payment_failed", {
  service: "payment",
  page: "payment.confirm",
  error_code: "PAYMENT_TIMEOUT",
});
```

사용자 입력, URL query, 계좌, token, 응답 body를 message/attribute에 보간하지 않는다. 진짜 exception은 같은 scope에 `service/page/error_code` Tag를 설정해 capture한다.

## 5. 가입 퍼널 계측

업무팀과 먼저 다음을 확정한다.

- 화면 순서와 step ID
- 진입, 다음 단계, 이탈, 완료의 정확한 발생 시점
- 새로고침·재시도·뒤로가기 중복 처리
- 하나의 가입 시도를 식별하는 `attempt_v1_*` 수명

가입 단계마다 고유 URL을 만들고 화면 진입 시 내부 분석 API에 `page_view`, 전환 시 `advanced`, 명시 이탈 시 `abandoned`, 최종 성공 시 `completed`를 보낸다. 가입 시도 ID는 `sessionStorage`에 보관해 URL 이동과 새로고침에도 유지한다. 같은 동작을 Sentry `ui.funnel` span과 `page.path`로도 기록하되 공식 분모는 내부 분석계를 사용한다.

이탈은 unload 이벤트 수신 여부로 결정하지 않는다. 서버가 같은 가입 시도의 다음 단계 `page_view` 또는 완료를 기다리고, `FUNNEL_DROPOFF_GRACE_PERIOD_MS`가 지난 미전환 시도를 이탈 확정으로 계산한다. 유예시간 안의 시도는 이탈 판단 대기로 분리하고, 같은 단계 새로고침은 도달 수에서 중복 제거한다.

## 6. 서비스 분리

`scripts/service-projects.json`의 slug를 수정한 뒤 프로젝트를 생성한다.

```bash
./scripts/configure-service-projects.sh
./scripts/configure-phase7-data-scrubbing.sh
```

두 번째 명령의 `SENTRY_PROJECTS`에 새 slug가 모두 들어가야 한다. 새 DSN으로 합성 이벤트를 보내 server probe가 통과하기 전에는 운영 트래픽을 연결하지 않는다.

모든 이벤트·Log·Span에 공통 `service`를 적용한다. 프로젝트와 service 값이 서로 모순되지 않도록 CI taxonomy test를 둔다.

## 7. 원본 사용자 ID와 내부 가명 ID

프론트에서 원본 UUID를 단순 SHA hash하지 않는다. 인증된 내부 backend가 KMS/HSM의 비밀키로 HMAC 또는 opaque mapping ID를 발급한다.

```text
원본 고객 ID --Sentry scope--> Sentry
원본 고객 ID --내부 TLS--> identity service --dbg_v1_*--> 내부 분석/JIT
```

프론트는 원본 고객 ID로 `Sentry.setUser({id})`를 호출하고 로그아웃 시 `Sentry.setUser(null)`을 호출한다. SDK와 Relay는 `$user.id`를 보존하되 email, username, IP 등 다른 사용자 필드를 제거한다. HMAC 발급값은 내부 분석과 JIT API에만 전달한다.

## 8. JIT 개인정보 조회

PoC `privacy-gate.mjs`를 실제 고객 DB에 직접 연결하지 않는다. 운영 구현은 다음 interface 경계로 교체한다.

```ts
interface PrivateProfileAdapter {
  getMinimumProfile(
    pseudonymousId: string,
    approvedContext: ApprovalContext,
  ): Promise<Profile>;
}
```

필수 통제:

- 사내 SSO + MFA/step-up 인증
- 대상 사용자, 사유, 승인 티켓
- 짧은 challenge와 session TTL
- one-time code 재사용 금지와 rate limit
- 사용자 변경·화면 종료 시 revoke
- 조회 결과 copy/export 제한
- append-only 감사 저장소와 정기 검토
- Sentry SDK가 없는 별도 origin 또는 `data-private` 전체 차단

## 9. 사용자 기준 오류율

실제 backend/분석계가 서비스별 활성 사용자를 기록하고, 오류가 발생한 고유 가명 사용자와 조인한다.

```text
affected_user_rate = unique(error actor) / unique(active actor)
```

분자·분모의 기간, 서비스, 환경, bot 제외 기준을 같게 한다. 분모가 0이면 null로 저장한다. Sentry Issue event count를 DAU로 나누는 식으로 서로 다른 단위를 혼합하지 않는다.

## 10. Dashboard 적용

`scripts/phase6-dashboards.json`의 `projects` ID를 대상 ID로 바꾼다. 그다음:

```bash
./scripts/create-phase6-dashboards.sh
```

스크립트는 모든 정의를 `validateOnly=1`로 검사하고 제목이 있으면 PUT update, 없으면 POST create한다. 특히 설치 버전이 다음 field를 승인하는지 확인한다.

```text
performance_score(measurements.score.total)
p75(browser.web_vital.lcp.value)
p75(browser.web_vital.fcp.value)
p75(browser.web_vital.inp.value)
p75(browser.web_vital.cls.value)
p75(browser.web_vital.ttfb.value)
```

## 11. 한국어 확장 배포

`browser-extension/manifest.json`의 `matches`를 사내 Sentry HTTPS origin으로 바꾼다. 보안 검토된 내부 확장 배포 정책으로 배포하고, Event/Tag/검색식/코드는 번역 대상에서 계속 제외한다. Sentry 소스 직접 번역 fork는 업그레이드 유지비를 감수할 때만 선택한다.

## 12. 필수 검증

```bash
cd test-app
pnpm exec vitest run
pnpm typecheck
pnpm lint
pnpm build

cd ..
node --test internal-observability/*.test.mjs scripts/*.test.mjs browser-extension/*.test.mjs
./scripts/configure-phase7-data-scrubbing.sh
./scripts/verify-phase7-data-scrubbing.sh --server-probe
./scripts/verify-phase7-data-scrubbing.sh --identity-probe
./scripts/create-phase6-dashboards.sh
```

완료 조건:

- 실제 저장 이벤트에서 합성 민감값 0건
- 승인 가명 ID만 보존
- Replay 저장본에서 인증·CDD·JIT 원문 0건
- Logs/Issues/Traces/Replay의 service·page 연결
- 퍼널과 사용자 오류율의 분자·분모 재현 가능
- Dashboard API 저장본에서 score/vital field 확인
- token, DSN secret file, HMAC key가 Git diff에 없음

## 운영 전 교체해야 하는 PoC 요소

- 로컬 기본 HMAC secret → KMS/HSM 관리 secret
- 화면에 보이는 일회용 code → MFA/별도 채널
- 합성 profile adapter → 최소 필드 고객 API
- 로컬 NDJSON → 접근통제된 DB와 append-only 감사 저장소
- 무인증 localhost API → 사내 인증, CSRF/CORS, TLS, rate limit
- Replay 100% → 보안·용량 승인 표본율

## 관련 문서

- [구현 설계](10-frontend-observability-design.md)
- [화면 주소와 운영 사용법](11-frontend-debugging-guide.md)
- [Phase 7 개인정보 정책](07-security.md)
