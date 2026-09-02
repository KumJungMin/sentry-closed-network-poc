# Phase 7: 개인정보·금융정보 보호

## 목표

실제 개인정보를 사용하지 않고 이름, 연락처, 계좌·주민등록 식별값, 인증정보, 금융 거래 원문을 합성 데이터로 주입한 뒤 다음 방어층을 검증한다.

1. React SDK가 전송 직전에 민감정보를 제거한다.
2. Self-hosted Sentry의 조직·프로젝트 스크러빙을 활성화한다.
3. 실제 저장 이벤트에서 합성 민감값이 남지 않았는지 API로 검사한다.

이 PoC의 기본 원칙은 “수집 후 숨김”이 아니라 “필요하지 않은 원문은 SDK envelope에 넣지 않음”이다.

## 비수집 대상

| 분류 | 예시 키 | 처리 |
| --- | --- | --- |
| 개인 식별 | name, phone, email, CI, 주민등록번호 | 키 제거 및 문자열 패턴 정제 |
| 금융 식별 | account_number, sender, recipient, transaction_id | 키 제거 |
| 인증정보 | OTP, 인증코드, access/refresh token | 키 제거 및 Bearer 문자열 정제 |
| HTTP 비밀 | Authorization, Cookie, 전체 headers | 제거 |
| 원문 payload | request/response body, API 원문, 전체 form | 제거 |
| URL 입력값 | query string, fragment | URL 경로만 유지 |
| 사용자 정보 | email, username, IP, 가공 전 ID | 제거 |

사용자 ID는 `anon-` 또는 `anon_`으로 시작하는 8자 이상의 사전 익명화 ID만 SDK 필터가 허용한다. 실제 고객번호, CI, 계좌번호를 단순 hash한 값은 원본 대입 공격 위험이 있으므로 익명 ID로 간주하지 않는다. 별도 비밀키를 사용하는 HMAC 또는 무작위 매핑 ID가 필요하다.

## React SDK 정책

`test-app/src/security/securityPolicy.core.ts`의 순수 함수가 SDK 전송 정책을 담당한다.

- `sendDefaultPii: false`
- `beforeSend`: user, request, extra, context, tag, breadcrumb, exception 문자열 정제
- `beforeBreadcrumb`: console과 입력 변경 breadcrumb 폐기, URL·본문·헤더 정제
- `ignoreErrors`: ResizeObserver와 비정상 Promise rejection 형식만 제외. 네트워크 실패는 장애 신호이므로 수집
- `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0`
- Replay integration 미등록
- `tracePropagationTargets`: localhost, 127.0.0.1, 동일 출처 상대 경로만 허용

환경별 기본 trace 표본율은 local/development 1.0, SIT/UAT/staging 0.5, production 0.1이다. `VITE_SENTRY_TRACES_SAMPLE_RATE`로 0~1 범위 값을 명시할 수 있고 `VITE_SENTRY_ENABLED=false`로 SDK 전송을 끌 수 있다. 개인정보·Replay 정책은 환경과 무관하게 항상 보수적으로 유지한다.

## 합성 개인정보 테스트 UI

테스트 앱의 `민감정보 비수집 검증` 섹션은 사용자가 자유롭게 개인정보를 입력하는 폼을 제공하지 않는다. 다음 규칙의 고정 합성값만 사용한다.

- 예약 이메일 도메인: `example.invalid`
- 명시적 합성 접두사: `FAKE-*`
- 문서용 전화·계좌·주민등록 형식: 실제 사용자와 연결되지 않는 0 중심 값

버튼을 누르면 격리 scope에 합성 user/context/breadcrumb를 넣고 `[PoC] Phase 7 privacy scrub verification` 오류를 전송한다. `beforeSend`가 실행되면 안전한 `security_phase`, `test_case`, `safe_business_state`만 남는다.

실제 개인정보, 실제 토큰, 실제 계좌·거래 식별자를 이 화면이나 검증 스크립트에 입력하면 안 된다.

## Self-hosted 서버 설정

다음 명령은 토큰 값을 출력하지 않고 조직과 `frontend-poc` 프로젝트에 정책을 병합한다.

```bash
./scripts/configure-phase7-data-scrubbing.sh
```

적용 결과:

- 조직: data scrubber ON, default scrubber ON, IP scrubbing ON
- 프로젝트: data scrubber ON, default scrubber ON, IP scrubbing ON
- 추가 민감 필드: 조직·프로젝트 각각 49개
- Advanced Data Scrubbing: 프로젝트 selector 57개
- 기존 Advanced rule이 있다면 덮어쓰지 않고 rule/application을 병합
- Relay 프로젝트 설정 캐시를 Sentry의 `invalidate_project_config`로 즉시 재계산

현재 토큰은 읽기 권한만 있어 조직 PUT API가 403을 반환한다. 스크립트는 Self-hosted 컨테이너의 공식 Django 모델과 Relay 설정 계산 경로를 사용하고, 적용 결과는 다시 읽기 API로 확인한다. SaaS 환경에서는 이 관리 셸 경로를 사용할 수 없으며 `org:write`/`project:write` 토큰 또는 관리자 UI가 필요하다.

## 자동 검증 결과

### 클라이언트 정책

보안 정책 테스트 8개가 다음을 확인한다.

- 전체 합성 민감값 제거
- request header/body/query 제거와 URL query/hash 제거
- 사전 익명화 사용자 ID만 허용
- console·입력 breadcrumb 폐기
- 환경별 trace 표본율과 Replay 0%
- 합성 이벤트 UI의 scope와 flush 흐름

프로젝트 전체 결과는 7개 테스트 파일, 29개 테스트 통과다. typecheck, ESLint, production build도 통과했다.

### 실제 저장 이벤트

```bash
./scripts/verify-phase7-data-scrubbing.sh
```

이 명령은 테스트 앱의 실제 `sanitizeSentryEvent` 함수를 Node에서 실행해 합성 원본을 정제하고, envelope를 로컬 Sentry에 전송한 뒤 Event Details API 저장본을 검사한다.

- 최종 검증 이벤트 ID: `7fb6f652341cac6a02e2d6223d8909e0`
- 이름·전화·이메일·계좌·주민등록번호·CI·OTP·토큰·Cookie·송수취인·API 원문·폼·거래 ID·가공 전 user ID 등 18개 원본: 없음
- 안전한 `privacy-scrub-test`: 유지

## 중요 제한: 서버 단독 probe

```bash
./scripts/verify-phase7-data-scrubbing.sh --server-probe
```

이 옵션은 클라이언트 필터를 고의로 우회해 합성 원본을 Relay에 직접 보낸다. 현재 Self-hosted 26.8.0 런타임에서는 다음 현상이 재현됐다.

- API와 계산된 Relay project config에는 기본 규칙, 민감 필드 49개, Advanced selector 57개가 존재한다.
- Sentry 서버의 `scrub_data(project, event)` 함수에 같은 payload를 직접 넣으면 규칙이 정상 제거한다.
- 그러나 실제 내부 Relay 수집 경로에서는 15개 합성 원본이 저장되어 probe가 실패한다.
- Relay 로그에 간헐적인 `Health check probe 'auth' failed`가 남지만 ready healthcheck는 통과한다.

따라서 현재 PoC에서 서버 스크러빙은 활성화된 보조 방어선일 뿐, 단독 안전장치로 인정하지 않는다. 클라이언트 필터를 제거하거나 원본 개인정보 전송을 허용하면 안 된다. 이 Relay 설정 전달 문제는 실제 회사 적용 전 해결해야 하는 보안 차단 항목이다. 실패 probe가 만든 이벤트에는 실제 개인정보가 아니라 `FAKE-*` 합성값만 들어 있다.

Advanced 규칙에는 request URL 제거도 포함돼 있다. Relay 문제가 해결되어 이 규칙이 적용되면 URL 대신 `page` 같은 사전 정의된 안전한 Tag를 진단에 사용한다.

## 운영 체크리스트

- 실제 입력 폼 전체나 API 원문을 `setContext`, `setExtra`, breadcrumb에 넣지 않는다.
- 사용자 입력값을 Error message나 exception 문자열에 보간하지 않고 고정 오류 코드·메시지를 사용한다. 이름은 자유 문자열만으로 안정적으로 탐지할 수 없다.
- 민감한 값은 Tag로 절대 만들지 않는다. Tag는 검색 인덱스와 대시보드 차원이 된다.
- 새 SDK 통합이나 Sentry 버전 업그레이드 때 보안 테스트와 실제 저장 검증을 다시 실행한다.
- Source map 업로드 토큰, API 토큰, DSN 파일은 Git에 커밋하지 않는다.
- Session Replay를 켜야 한다면 별도 보안 심사와 mask/block selector 검증을 먼저 수행한다.
- `--server-probe`가 통과하기 전에는 서버 필터만 믿는 애플리케이션을 운영에 반영하지 않는다.

## 구현 파일

- `test-app/src/security/securityPolicy.core.ts`: 전송 직전 순수 정제 정책
- `test-app/src/security/securityTest.core.ts`: 합성 데이터 fixture
- `test-app/src/security/useSecurityTest.ts`: 격리 scope 이벤트 전송
- `test-app/src/security/SecurityTestSection.tsx`: 보안 검증 UI
- `test-app/src/security/*.test.ts*`: 정책·사용자 흐름 테스트
- `scripts/configure-phase7-data-scrubbing.sh`: 조직·프로젝트 서버 설정
- `scripts/phase7-sensitive-fields.json`: 추가 민감 필드
- `scripts/phase7-relay-pii-config.json`: Advanced selector와 제거 rule
- `scripts/verify-phase7-data-scrubbing.sh`: 실제 저장본 자동 검증

## 공식 참고 자료

- [React SDK configuration options](https://docs.sentry.io/platforms/javascript/guides/react/configuration/options/)
- [React SDK breadcrumbs](https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/breadcrumbs/)
- [Update an organization API](https://docs.sentry.io/api/organizations/update-an-organization/)
- [Update a project API](https://docs.sentry.io/api/projects/update-a-project/)
- [Self-hosted Sentry](https://develop.sentry.dev/self-hosted/)
