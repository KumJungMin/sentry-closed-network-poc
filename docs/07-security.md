# Phase 7: 개인정보·금융정보 보호

## 목표

실제 개인정보 없이 합성 데이터만 사용해 세 방어층을 검증한다.

1. React SDK가 envelope 생성 직전에 불필요한 원문을 제거한다.
2. Relay가 클라이언트 필터를 우회한 이벤트도 다시 정제한다.
3. 검색용 원본 `user.id`만 명시적으로 허용하고, 나머지 개인정보 원문 조회는 Sentry 밖 JIT 게이트에서만 수행한다.

기본 원칙은 “수집 후 숨김”이 아니라 “진단에 필요 없는 원문을 수집하지 않음”이다.

## 비수집 대상

| 분류 | 예시 | 처리 |
| --- | --- | --- |
| 개인 식별 | 이름, 전화, 이메일, CI, 주민번호 | key 제거·문자열 정제 |
| 금융 식별 | 계좌, 송수취인, 거래 ID | 제거 |
| 인증 | OTP, 인증코드, access/refresh token | 제거 |
| HTTP 비밀 | Authorization, Cookie, headers, body | 제거 |
| URL 입력값 | query string, fragment | 경로만 유지 또는 Relay에서 URL 제거 |
| 사용자 정보 | email, username, IP | 제거 |
| 사용자 식별자 | `user.id` | 원본 보존·검색 허용 |

`user.id`는 사용자 흐름을 직접 연결하기 위한 유일한 원본 식별자 예외다. 이름·이메일·전화번호·계좌 등 다른 개인정보를 ID에 합성하지 않으며, Sentry 접근 권한·보존 기간·감사 로그를 개인정보 시스템 수준으로 관리해야 한다. 내부 분석과 JIT 게이트는 기존 `dbg_v1_[A-Za-z0-9_-]{20,80}` HMAC ID를 계속 사용한다.

## React SDK 정책

구현은 `test-app/src/security/securityPolicy.core.ts`와 `test-app/src/sentry/replay.ts`에 있다.

- `sendDefaultPii: false`
- `beforeSend`: user/request/extra/context/tag/breadcrumb/exception 정제
- `beforeBreadcrumb`: console·입력 변경 폐기, URL·본문·header 정제
- `ignoreErrors`: 알려진 브라우저 noise만 제외
- `tracePropagationTargets`: localhost, 127.0.0.1, 동일 출처 상대 경로
- 로컬 Replay ON, 일반 세션 0%, 오류 발생 세션 100%; production explicit opt-in
- Replay의 모든 text/input/media 마스킹
- `[data-sentry-block]`, `[data-private]` 전체 차단
- Replay network body/header 상세 수집 금지

환경별 trace 기본 표본율은 local 1.0, SIT/UAT/staging 0.5, production 0.1이다. Replay는 일반 세션을 전송하지 않고 오류가 발생한 세션만 100% 전송한다.

## Relay 서버 정책

다음 명령은 조직과 네 프론트 프로젝트에 동일한 정책을 적용하고 project config cache를 갱신한 뒤 Relay를 재시작한다.

```bash
./scripts/configure-phase7-data-scrubbing.sh
```

대상 프로젝트:

- `frontend-poc`
- `frontend-membership`
- `frontend-remittance`
- `frontend-payment`

각 프로젝트는 data scrubber/default/IP ON과 민감 필드 49개를 유지한다. Advanced selector에서 `$user.id` 제거 규칙만 제외하므로 원본 ID가 보존되고, `$user.email`, `$user.username`, `$user.ip_address`와 나머지 민감 필드는 계속 제거된다.

설정 변경 중 Relay와 nginx가 재시작되어 수 초간 UI·ingest가 끊길 수 있다. 운영에서는 변경 창구와 rollback 절차를 둔다.

## 내부 분석용 가명 ID 발급

`internal-observability/identity-core.mjs`가 원본 UUID를 HMAC-SHA256으로 변환한다.

- 같은 UUID와 key → 같은 가명 ID
- 원본 UUID 저장 없음
- 내부 분석·JIT API에서 형식 검증
- 테스트 앱에서 Sentry 조회용 원본 ID와 내부 분석용 ID를 구분해 표시

로컬 기본 secret은 합성 PoC 전용이다. 운영에서는 KMS/HSM, key version, rotation, 접근 감사가 필요하다.

## JIT 개인정보 조회

`privacy-gate.mjs`는 Sentry 밖에서 다음을 강제한다.

- 가명 ID, 조회 사유, 승인 티켓
- 5분 one-time challenge, 최대 5회 시도
- 사용자에 고정된 10분 세션
- 즉시 종료 및 사용자 전환/화면 해제 시 revoke
- code/token을 제외한 감사 기록
- `synthetic-poc-adapter` 합성 프로필만 반환

운영에서는 SSO/MFA, rate limit, TLS, 실제 최소 필드 adapter, append-only 감사 저장소로 교체해야 한다. 조회 결과는 Sentry Tag·Context·Log·Replay에 복사하지 않는다.

## 자동 저장 검증

### 클라이언트 정제

```bash
./scripts/verify-phase7-data-scrubbing.sh
```

실제 `sanitizeSentryEvent`를 통과한 합성 이벤트를 보내 저장본에서 원본 `user.id` 보존, 나머지 17개 원본 민감값 부재와 안전한 `privacy-scrub-test` 유지를 확인한다.

### Relay 서버 단독 방어

```bash
./scripts/verify-phase7-data-scrubbing.sh --server-probe
```

SDK를 우회한 원본 이벤트를 Relay에 직접 보내도 원본 `user.id`는 보존되고 나머지 17개 합성 민감값은 제거되는지 확인한다.

### 승인 가명 ID 보존

```bash
./scripts/verify-phase7-data-scrubbing.sh --identity-probe
```

같은 민감값 제거를 확인하면서 내부용 `dbg_v1_*` ID도 일반 `user.id` 값처럼 저장되는지 검사한다.

server probe와 identity probe는 서로 다른 ID 형식에서 동일한 보존 정책을 확인한다.

## Replay 별도 검증

오류 이벤트의 Relay probe가 Replay recording을 대신하지 않는다. 운영 전 다음 합성 원문을 DOM에 넣고 실제 Replay 저장본과 재생 화면에서 0건인지 검사한다.

- 이름·전화·이메일·계좌·주민번호 형식
- OTP·token·Cookie 형식
- 인증/CDD 키패드와 개인정보 JIT 영역
- navigation query/fragment
- request/response body

하나라도 나타나면 Replay를 즉시 끄고 해당 segment의 삭제·보존 범위를 조사한다.

## 운영 체크리스트

- 입력 form/API 원문을 Context, Extra, breadcrumb에 넣지 않는다.
- 사용자 값을 exception message에 보간하지 않는다.
- `user.id` 외 개인정보를 검색 인덱스인 Tag로 만들지 않는다.
- 신규 프로젝트 생성 직후 Phase 7 설정을 적용한다.
- SDK/Sentry 업그레이드 때 두 Relay probe와 Replay probe를 재실행한다.
- DSN 외 auth token, source map token, HMAC key를 Git에 저장하지 않는다.
- JIT audit와 Sentry 조직 audit를 정기 검토한다.

## 구현 파일

- `test-app/src/security/securityPolicy.core.ts`: SDK 전송 정제
- `test-app/src/sentry/replay.ts`: Replay 마스킹·차단
- `internal-observability/identity-core.mjs`: HMAC 가명 ID
- `internal-observability/privacy-gate.mjs`: 합성 JIT 게이트
- `scripts/phase7-relay-pii-config.json`: Relay rule/application
- `scripts/configure-phase7-data-scrubbing.sh`: 네 프로젝트 설정
- `scripts/refresh_phase7_relay_config.py`: Relay cache 갱신
- `scripts/verify-phase7-data-scrubbing.sh`: 저장본 probe

## 공식 참고 자료

- [React SDK configuration](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/)
- [Session Replay privacy](https://docs.sentry.io/platforms/javascript/guides/react/session-replay/privacy/)
- [Relay PII configuration](https://getsentry.github.io/relay/relay_pii/index.html)
- [Self-hosted Sentry](https://develop.sentry.dev/self-hosted/)
