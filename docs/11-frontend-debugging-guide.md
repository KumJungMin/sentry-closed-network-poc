# 프론트엔드 디버깅 기능·화면 사용 안내

## 기준 환경

- 테스트 앱: `http://127.0.0.1:5173`
- 내부 분석/JIT API: `http://127.0.0.1:4318`
- Sentry: `http://127.0.0.1:9000`
- 조직: `sentry`
- 기본 프로젝트: `frontend-poc` (ID 2)
- 서비스 프로젝트: membership ID 3, remittance ID 4, payment ID 5

먼저 `test-app`에서 `pnpm analytics`와 `pnpm dev`를 각각 실행한다. Sentry와 Docker 상태는 `./scripts/check-poc.sh`로 확인한다.

## 빠른 화면 목록

| 목적 | 주소 | 사용법 |
| --- | --- | --- |
| 모든 오류 | `http://127.0.0.1:9000/organizations/sentry/issues/?project=2` | project/environment/release 후 Tag 검색 |
| 구조화 Logs | `http://127.0.0.1:9000/organizations/sentry/explore/logs/?project=2` | message, service, page로 필터 |
| Trace/Span | `http://127.0.0.1:9000/organizations/sentry/explore/traces/?project=2` | trace 또는 `ui.funnel` op 확인 |
| Session Replay | `http://127.0.0.1:9000/organizations/sentry/explore/replays/?project=2` | user.id, 오류, rage/dead click 검색 |
| Frontend Insights | `http://127.0.0.1:9000/organizations/sentry/insights/frontend/?project=2` | 페이지·API 성능 개요 |
| Web Vitals | `http://127.0.0.1:9000/organizations/sentry/insights/frontend/pageloads/?project=2` | page score와 vital 분포 분석 |
| Dashboard 1 안정성 | `http://127.0.0.1:9000/organizations/sentry/dashboard/1/` | 전체·사용자·미해결·release |
| Dashboard 2 서비스 | `http://127.0.0.1:9000/organizations/sentry/dashboard/2/` | service/channel/error_code 분해 |
| Dashboard 3 성능 | `http://127.0.0.1:9000/organizations/sentry/dashboard/3/` | Score, FCP/LCP/INP/CLS/TTFB |
| Dashboard 4 일간 | `http://127.0.0.1:9000/organizations/sentry/dashboard/4/` | 최근 24시간 |
| Dashboard 5 주간 | `http://127.0.0.1:9000/organizations/sentry/dashboard/5/` | 최근 7일 |
| Dashboard 6 월간 | `http://127.0.0.1:9000/organizations/sentry/dashboard/6/` | 최근 30일 |
| Source Maps | `http://127.0.0.1:9000/settings/sentry/projects/frontend-poc/source-maps/` | release와 artifact bundle 확인 |
| Client Keys/DSN | `http://127.0.0.1:9000/settings/sentry/projects/frontend-poc/keys/` | DSN 복사, Git 저장 금지 |
| Replay 설정 | `http://127.0.0.1:9000/settings/sentry/projects/frontend-poc/replays/` | 보존·접근 정책 확인 |
| Sentry 감사 로그 | `http://127.0.0.1:9000/settings/sentry/audit-log/` | 조직 설정 변경 점검 |

## 기능별 사용법

### 1. Sentry 한국어 표시

1. Chrome에서 `chrome://extensions`를 연다.
2. 개발자 모드를 켜고 **압축해제된 확장 프로그램 로드**를 누른다.
3. 저장소의 `browser-extension` 폴더를 선택한다.
4. Sentry 탭을 새로고침한다.

메뉴·버튼은 한국어가 되지만 검색 필드와 Tag는 영문 그대로 쓴다. 번역 추가는 `browser-extension/dictionary.js`에 정확한 원문 쌍을 추가한다.

### 2. Session Replay

1. 테스트 앱에서 `가명 ID 연결`을 실행한다.
2. 가입 화면·로그·오류 버튼을 조작한다.
3. Explore > Replays에서 `user.id:dbg_v1_...`로 검색한다.
4. timeline과 Issue/Trace 연결을 확인한다.

텍스트·입력·미디어가 원문으로 보이거나 개인정보 게이트 영역이 재생되면 즉시 `VITE_SENTRY_REPLAY_ENABLED=false`로 끄고 저장 범위를 조사한다.

### 3. 가입 퍼널·화면별 이탈률

테스트 앱의 **가입 퍼널과 화면별 이탈률**에서 플로우를 시작한 뒤 각 화면에서 **다음 화면** 또는 **여기서 이탈**을 누른다. 우측 내부 집계가 도달·이탈 사용자 수를 즉시 갱신한다.

Sentry에서는 Explore > Traces에서 다음으로 원인을 찾는다.

```text
span.op:ui.funnel service:membership
```

정확한 이탈률은 테스트 앱/내부 분석 API, 오류 원인은 Sentry를 기준으로 한다.

### 4. 오류와 구조화 Logs

테스트 앱의 **실시간 오류·커스텀 로그**에서 info/warn/error 시나리오를 보낸다. Logs에서 다음 고정 message를 검색한다.

```text
frontend_action_completed
frontend_api_slow
frontend_payment_failed
```

error 시나리오는 Issues에도 `[PoC] synthetic payment timeout`을 만든다. 수 초 지연은 정상이며 envelope HTTP 200이 아니라 최종 검색 결과를 확인한다.

### 5. 서비스별 오류

테스트 앱의 **서비스별 오류 탐색**에서 서비스를 선택하고 Issues/Logs/Traces를 연다. 수동 검색 예시는 다음과 같다.

```text
is:unresolved service:payment
service:membership page:signup.phone
```

독립 배포 앱은 상단 project selector에서 `frontend-membership`, `frontend-remittance`, `frontend-payment`를 직접 선택한다.

### 6. 특정 사용자 행동

테스트 앱의 **특정 사용자 행동 추적**에서 합성 UUID를 가명 ID로 변환한다. 표시된 `dbg_v1_*` ID는 숨기지 않고 디버깅 조회 키로 사용한다.

- Issues: `user.id:<dbg_v1 ID>`
- Replays: 같은 검색식으로 세션 재생
- Traces: 같은 ID와 시각 범위로 흐름 확인

원본 UUID, 이메일, 전화번호는 Sentry 검색창에 넣지 않는다.

### 7. 개인정보 ON/OFF

가명 ID를 연결한 뒤 **개인정보 ON/OFF 조회 게이트**에서 사유와 티켓을 확인하고 승인을 요청한다. PoC는 합성 데이터이므로 일회용 코드를 화면에 되돌려주지만, 운영에서는 MFA/별도 인증 채널로 보내야 한다.

인증 후 10분 동안 합성 이름·휴대폰·계좌·CDD 상태가 보인다. **즉시 조회 종료**, 사용자 변경, 화면 해제 중 하나가 발생하면 세션을 폐기한다. 감사 파일은 `.runtime/internal-observability/privacy-audit.ndjson`이며 code와 token은 기록하지 않는다.

### 8. 일간·주간·월간 오류

Dashboard 4~6 중 목적에 맞는 기간을 연다. 오류 건수만 보지 말고 Affected Users, trend, Top Errors를 함께 본다. 월 보고가 달력 월 기준이면 Dashboard 6의 absolute date를 월 시작/종료로 바꾼다.

### 9. 오류 순위와 사용자 대비 비율

먼저 가명 ID를 연결한다. 테스트 앱의 **사용자 기준 오류 순위·이탈률**에서:

1. **정상 사용자 모수 +1**로 payment 활성 사용자를 기록한다.
2. **Sentry 오류 + 영향 사용자 기록**으로 실제 Sentry error와 내부 numerator를 함께 만든다.
3. `영향 사용자/활성 사용자`와 가입 화면 이탈률을 확인한다.

`모수 없음`은 0%가 아니다. 운영에서는 버튼 대신 실제 인증/페이지 방문 backend 이벤트가 denominator를 공급해야 한다.

### 10. 페이지별 Web Vitals와 Performance Score

Dashboard 3에서 전체 score와 페이지 table을 빠르게 확인한다. 이상 페이지는 Web Vitals Insights에서 다음 순서로 좁힌다.

1. production 환경과 release 선택
2. 표본 수 확인
3. 낮은 Score 또는 나쁜 LCP/INP/CLS 정렬
4. browser/device/page별 범위 축소
5. 관련 pageload trace와 resource/API span 확인

## 오류 한 건을 추적하는 표준 순서

1. Issues에서 `project → environment → release → service → page` 순으로 좁힌다.
2. Source map이 적용된 첫 application frame을 확인한다.
3. Breadcrumb에서 navigation·업무 단계·fetch 직전 상태를 복원한다.
4. Trace에서 실패/지연 span을 찾는다.
5. 같은 `user.id`의 Replay로 실제 행동 순서를 확인한다.
6. 구조화 Logs에서 전후 상태를 검색한다.
7. 개인정보가 꼭 필요한 경우에만 Sentry 밖 JIT 게이트를 연다.
8. regression과 영향 사용자율을 보고 수정·rollback 우선순위를 정한다.

## 추가 프론트엔드 디버깅 기능

- Source map: minified stack을 원본 TS/TSX로 복원
- Release/Regression: 배포 이후 재발 오류 구분
- Breadcrumb: 오류 직전 사용자·업무 흐름 복원
- Trace: 프론트→내부 API 병목 연결
- Fingerprint: 동적 사용자 값 없이 안정적인 Issue grouping
- Alert/Ownership: service·error_code 기반 담당팀 routing
- Event JSON: UI에서 생략된 정제 필드 검증
- Feature flag Tag: rollout별 회귀 상관관계 분석

Sentry 자체 Kafka, ClickHouse, PostgreSQL, Relay, 디스크는 Sentry 내부 이벤트가 아니라 별도 Grafana/Prometheus 계열로 감시한다.

## 운영 루틴

- 매일: Dashboard 4, 새/미해결 Issue, error 영향 사용자율
- 매주: Dashboard 5, release/browser/service 분포, Replay 표본과 마스킹
- 매월: Dashboard 6, 보존량·디스크, JIT/조직 감사 로그, HMAC·token 정책

## 관련 문서

- [구현 설계](10-frontend-observability-design.md)
- [다른 프로젝트 적용 Quick Guide](12-frontend-observability-quick-guide.md)
- [개인정보 정책](07-security.md)
