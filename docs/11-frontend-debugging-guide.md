# 프론트엔드 디버깅 기능·화면 사용 안내

## 이 문서의 사용법

아래 주소는 현재 설치된 Self-hosted Sentry 26.8.0, 조직 `sentry`, 프로젝트 `frontend-poc` 기준이다. 다른 회사 환경에서는 호스트, 조직 slug, 프로젝트 ID를 바꾼다.

- 기준 호스트: `http://127.0.0.1:9000`
- 조직 slug: `sentry`
- 프로젝트 ID: `2`
- 프로젝트 slug: `frontend-poc`

Sentry의 영문 메뉴가 익숙하지 않은 개발자는 먼저 이 문서의 “오류 한 건 추적 순서”를 따라가면 된다. Chrome 번역을 사용해도 검색 필드와 Tag 이름은 문서에 적힌 영문 그대로 입력한다.

## 빠른 화면 목록

| 목적 | 화면 | 주소 | 현재 상태 |
| --- | --- | --- | --- |
| 새 오류·반복 오류 확인 | Issues | `http://127.0.0.1:9000/organizations/sentry/issues/?project=2` | 사용 가능 |
| 구조화 로그 검색 | Explore > Logs | `http://127.0.0.1:9000/organizations/sentry/explore/logs/?project=2` | 서버 화면/API 있음, 앱 전송 설정 필요 |
| Trace와 Span 확인 | Explore > Traces | `http://127.0.0.1:9000/organizations/sentry/explore/traces/?project=2` | 사용 가능 |
| Session Replay | Explore > Replays | `http://127.0.0.1:9000/organizations/sentry/explore/replays/?project=2` | 서버 기능 있음, 앱은 정책상 OFF |
| 릴리스별 오류·회귀 | Releases | `http://127.0.0.1:9000/organizations/sentry/explore/releases/?project=2` | 사용 가능 |
| 프론트 성능 개요 | Insights > Frontend | `http://127.0.0.1:9000/organizations/sentry/insights/frontend/?project=2` | 사용 가능 |
| 페이지 Web Vitals | Insights > Frontend > Web Vitals | `http://127.0.0.1:9000/organizations/sentry/insights/frontend/pageloads/?project=2` | 사용 가능 |
| 프론트 안정성 | Dashboard 1 | `http://127.0.0.1:9000/organizations/sentry/dashboard/1/` | 구현 완료 |
| 서비스·업무 오류 | Dashboard 2 | `http://127.0.0.1:9000/organizations/sentry/dashboard/2/` | 구현 완료 |
| API·Web Vitals | Dashboard 3 | `http://127.0.0.1:9000/organizations/sentry/dashboard/3/` | 구현 완료 |
| 알림·Detector | Monitors | `http://127.0.0.1:9000/organizations/sentry/monitors/` | 규칙 설정 필요 |
| Source map 업로드 확인 | Project Settings > Source Maps | `http://127.0.0.1:9000/settings/sentry/projects/frontend-poc/source-maps/` | 사용 가능 |
| DSN 확인 | Project Settings > Client Keys | `http://127.0.0.1:9000/settings/sentry/projects/frontend-poc/keys/` | 사용 가능 |
| Replay 프로젝트 설정 | Project Settings > Replays | `http://127.0.0.1:9000/settings/sentry/projects/frontend-poc/replays/` | 승인 전 변경 금지 |
| 언어·시간대 | Account Details | `http://127.0.0.1:9000/settings/account/details/` | 한국어 선택지 없음 |
| 조직 감사 기록 | Audit Log | `http://127.0.0.1:9000/settings/sentry/audit-log/` | 운영 점검용 |

메뉴 개편 시에도 위 주소의 핵심 route는 설치된 26.8.0 소스에서 확인한 값이다. `/organizations/sentry/replays/`처럼 구형 주소는 현재 Explore 주소로 redirect될 수 있다.

## 오류 한 건 추적 순서

### 1. Issues에서 범위를 줄인다

Issues를 열고 프로젝트, 환경, 기간을 먼저 고른다. 검색식은 다음 순서로 추가한다.

```text
is:unresolved service:membership page:signup-phone
```

필요하면 다음 Tag도 사용한다.

- `error_code:PHONE_VERIFICATION_TIMEOUT`
- `release:frontend-poc@0.1.0`
- `flow_step:phone-verification`
- `channel:hana-ez`
- `browser.name:Chrome`

오류 이벤트가 많은 순서와 영향 사용자 수가 많은 순서는 의미가 다르다. 현재 PoC는 Relay가 `user.id`를 제거하므로 영향 사용자 수가 0인 것이 정상이다.

### 2. Issue 상세에서 stack trace를 먼저 본다

Issue 제목을 열고 다음을 확인한다.

1. 오류 발생 파일·함수·코드 줄이 원본 TypeScript로 복원됐는지
2. 첫 발생/마지막 발생 시각과 release
3. environment, service, page, error_code Tag
4. 동일 Issue의 이벤트 빈도
5. 오류가 재발한 regression인지

stack이 minified 파일 한 줄만 가리키면 Source map 업로드와 SDK의 `release` 일치를 먼저 해결한다. Source map 화면에서 artifact bundle이 존재하는지 확인하고 [업로드 스크립트](../scripts/upload-test-app-sourcemaps.sh)를 다시 점검한다.

### 3. Breadcrumb로 직전 행동을 복원한다

Issue 상세의 Breadcrumbs에서 navigation, fetch/XHR, 업무 단계 순서를 본다. 이 PoC는 다음처럼 원문 대신 안전한 상태만 남긴다.

```text
송금 화면 진입
금액 입력 완료 (amount_included=false)
수취인 입력 완료 (recipient_data_included=false)
수취인 검증 API 요청 (endpoint_alias=recipient-validation)
검증 실패 (error_code=...)
오류 발생
```

고객 이름, 입력값, URL query, request/response body가 보이면 정상 기능이 아니라 개인정보 사고 후보이므로 캡처·공유를 중단하고 보안 담당자에게 알린다.

### 4. 관련 Trace를 확인한다

Issue 상세에 Trace가 연결되어 있으면 이를 열어 느린 구간, 실패 Span, 브라우저 요청과 백엔드 구간을 확인한다. 별도 검색은 Explore > Traces에서 한다.

분산 Trace를 연결하려면 내부 API가 `sentry-trace`와 `baggage` header를 CORS에서 허용하고, 프론트 `tracePropagationTargets`가 실제 내부 API origin을 명시해야 한다. 모든 외부 origin에 header를 보내면 안 된다.

### 5. Logs와 Replay는 필요한 경우만 연다

Logs에서는 고정 메시지와 구조화 속성으로 앞뒤 상태를 검색한다. Replay가 승인·활성화된 환경이라면 Issue의 Replay preview 또는 Replays 화면에서 같은 시각의 세션을 본다.

Replay에 인증·CDD·키패드 원문이 나타나면 즉시 기능을 끄고 유출 범위와 저장 세그먼트를 조사한다. 마스킹 해제 selector를 임의로 추가하지 않는다.

### 6. Release와 배포 전후를 비교한다

Releases에서 해당 release의 새 Issue와 first/last event를 확인한다. 배포 직후 급증했다면 이전 release와 비교하고, rollback 판단에는 오류율뿐 아니라 사용자 영향과 핵심 flow 실패도 함께 본다.

## 요구 기능별 사용법

### 한국어

Account Details > Language에는 한국어가 없다. 개인 브라우저 번역과 이 문서를 사용한다. 번역된 검색 예시를 그대로 입력하지 말고 `service`, `page`, `is:unresolved` 같은 원래 필드를 유지한다.

### Session Replay

Explore > Replays에서 오류 수, rage/dead click, 브라우저 등으로 찾고 세션을 열어 timeline을 재생한다. 현재 테스트 앱에서는 데이터가 없는 것이 정상이다. Replay 도입 조건과 차단 대상은 [종합 설계](10-frontend-observability-design.md#2-session-replay)를 따른다.

### 가입 플로우·이탈률

Sentry Logs 또는 Dashboard에서 `flow_name:member-signup`을 적용하고 `flow_step`, `transition`으로 나눈다. 화면별 오류 원인 진단에는 Sentry를 쓰되 공식 이탈률은 내부 분석 화면에서 확인한다.

Sentry 축소 지표를 사용할 때 화면에 다음 라벨을 붙인다.

```text
운영 진단용 근사치 · 재시도/새로고침 중복 포함 · 고객 원장 수치 아님
```

### 실시간 오류·로그

- 예외와 업무 warning: Issues에서 새로고침 또는 자동 갱신으로 확인
- 구조화 로그: Explore > Logs에서 level, message, service, page, trace로 검색
- 수집 지연이 길면 브라우저 Network의 envelope 결과만 보지 말고 consumer health와 최종 저장 이벤트를 확인

HTTP 200 ingest 응답은 처리 큐 접수만 뜻할 수 있으므로 최종 검색 가능 상태까지 확인한다.

### 서비스별 오류

Dashboard 2의 Errors by Service를 사용한다. Issues에서는 `service:<값>`으로 검색한다. 독립 배포 서비스라면 상단 Project selector로 프로젝트 자체를 선택한다.

### 특정 사용자/가입 시도

현재 기본 정책에서는 사용자 UUID 검색을 지원하지 않는다. 사고 티켓에 Sentry event ID, trace ID, 가입 시도용 `journey_id`를 기록해 같은 흐름을 연결한다. 가명 ID 모드가 승인된 뒤에만 `user.id:<debug_subject_id>` 검색을 제공한다.

### 개인정보 조회

Sentry 화면에서는 개인정보를 켜지 않는다. Issue에 보이는 opaque correlation ID를 별도 사내 개인정보 조회 게이트에 넣고 SSO/MFA/JIT 승인 후 최소 정보만 본다. 조회 결과를 Issue 댓글이나 Tag에 붙여 넣지 않는다.

### 일·주·월 오류

Dashboard 1의 기간 선택기를 사용한다.

- 일간: 최근 24시간
- 주간: 최근 7일
- 월간 추세: 최근 30일
- 달력 월 보고: start/end를 해당 월 경계로 직접 지정

기간을 바꾼 뒤 `Total Errors`, `Unresolved Issues`, `New and Resolved Issues`, `Errors by Release`를 함께 본다.

### 오류 순위·사용자 대비 비율

Issues에서 빈도순으로 정렬하면 반복 오류 Top N을 볼 수 있다. 영향 사용자순은 가명 사용자 ID가 승인된 경우만 유효하다. 사용자 모수 대비 비율은 정상 세션 또는 내부 DAU가 필요하므로 Dashboard의 단순 오류 건수를 퍼센트로 오해하지 않는다.

### Web Vitals

Insights > Frontend > Web Vitals에서 다음 순서로 본다.

1. 프로젝트와 production 환경 선택
2. 최소 표본 수 확인
3. 전체 Performance Score와 LCP/FCP/INP/CLS/TTFB 확인
4. 페이지별 table에서 낮은 점수 정렬
5. 느린 페이지를 열어 span과 관련 Issue 확인
6. release 또는 브라우저별로 재현 범위 축소

Dashboard 3은 빠른 운영 화면이다. Web Vitals 정밀 분석은 Insights 화면을 사용한다.

## 추가로 유용한 프론트엔드 기능

### Source map과 원본 코드 stack

난독화된 production bundle 오류를 원본 TypeScript/TSX 줄로 복원한다. 프론트 디버깅 효율에 가장 직접적인 기능이다.

- 화면: Project Settings > Source Maps
- 사용: artifact bundle 존재 여부 → event의 release 일치 → Issue stack의 원본 줄 순서로 확인
- 주의: 생성된 `.map` 파일을 웹 서버가 일반 사용자에게 제공하지 않도록 hidden source map 또는 빌드 후 삭제를 사용

### Issue grouping과 fingerprint

같은 원인의 반복 이벤트를 하나의 Issue로 묶는다. 지나치게 많이 합쳐지거나 같은 오류가 분리될 때만 fingerprint를 조정한다. 동적 사용자 입력을 오류 message에 넣으면 grouping이 폭발하므로 고정 오류 코드와 message를 쓴다.

### Regression과 release 비교

해결한 Issue가 새 release에서 다시 발생했는지 확인한다. 모든 배포는 동일한 release 값을 SDK 초기화와 Source map 업로드에 사용해야 한다.

### Tag와 Context

- Tag: 검색·그룹·대시보드에 필요한 저카디널리티 문자열
- Context: 한 이벤트 상세에서만 보는 구조화 진단 정보

Context는 검색되지 않는다. 무엇이든 Tag로 복제하지 말고 검색 필요성과 개인정보 등급을 먼저 결정한다.

### Breadcrumb

오류 직전의 navigation, API, 업무 상태를 시간순으로 본다. 전체 Redux 상태나 form 값을 넣는 로그 저장소가 아니다.

### Trace와 느린 작업

페이지 로드, API, 긴 UI task, route 전환 시간을 Span으로 비교한다. `startSpan`으로 직접 측정할 때 이름과 `op`을 고정해 집계 가능하게 한다.

### HTTP 요청 성능

`http.client` Span이 있으면 endpoint alias별 요청량, 평균/p95 지연, 4xx/5xx 비율을 볼 수 있다. Dashboard 3에 위젯은 있지만 현재 PoC 표본에는 해당 Span이 없어서 빈 상태다. 실제 내부 API 호출과 CORS/trace propagation을 연결한 뒤 검증한다.

### Alert, ownership, triage

새 Issue, 오류 급증, 핵심 서비스 실패, Web Vital 악화를 Detector/Alert로 만든다. `service`와 `error_code`를 사용해 담당 팀에 라우팅한다. 폐쇄망에서 외부 Slack/PagerDuty를 가정하지 말고 사내 SMTP나 내부 webhook의 도달성을 따로 검증한다.

### Event JSON

Issue 상세의 event action에서 JSON을 열면 UI에 접힌 필드와 SDK payload를 확인할 수 있다. 개인정보 검증 시 화면만 보지 말고 최종 저장 JSON/API까지 검사한다.

### Feature flag 상관관계

새 UI를 flag로 배포한다면 평가 결과를 오류와 연결해 특정 flag 값에서만 회귀했는지 본다. flag 이름과 boolean/작은 enum만 기록하고 사용자 실험군 ID는 넣지 않는다. 설치 버전의 feature flag 화면 노출과 SDK 지원은 실제로 재검증한다.

### Sentry 자체 인프라 모니터링

Sentry UI가 열리는지만 감시해서는 Kafka, ClickHouse, PostgreSQL, Relay 장애를 놓칠 수 있다. Docker/호스트 CPU·메모리·디스크, consumer lag, container health는 별도 Prometheus/Grafana 또는 사내 관제에 넣는다.

### 폐쇄망에서 제외할 기능

- 외부 AI/Seer 기능은 망 외부 의존성과 데이터 반출 검증 전 사용하지 않는다.
- 외부 GitHub, Slack, Jira 연동은 내부 설치 인스턴스 또는 승인된 프록시가 없으면 사용하지 않는다.
- CDN에서 SDK를 내려받지 않고 패키지와 artifact를 사내 저장소로 반입한다.

## 영문 메뉴 용어집

| 영문 | 한국어 의미 |
| --- | --- |
| Issues | 같은 원인으로 묶인 오류 목록 |
| Event | 실제 오류 발생 한 건 |
| Affected Users | 해당 오류를 겪은 고유 사용자 수 |
| Breadcrumbs | 오류 직전 행동·상태의 시간순 기록 |
| Tags | 검색·집계 가능한 문자열 속성 |
| Contexts | 이벤트 상세용 구조화 정보 |
| Trace | 여러 서비스와 Span을 연결한 요청 흐름 |
| Span | 흐름 안의 개별 작업과 소요 시간 |
| Release | 배포 버전 |
| Regression | 해결한 오류의 재발 |
| Replay | 브라우저 세션 동작 재생 |
| Web Vitals | LCP, FCP, INP, CLS, TTFB 등 사용자 체감 성능 |
| Fingerprint | 이벤트를 Issue로 묶는 그룹 기준 |
| Detector | 조건을 감시해 이상을 판정하는 규칙 |

## 운영 점검 루틴

### 매일

- 새 Issue와 escalating/regressed Issue 확인
- production 핵심 서비스 오류 Top N 확인
- consumer/container health와 디스크 확인

### 매주

- 서비스·release별 오류 추세
- 해결되지 않은 오래된 Issue 정리
- 느린 페이지와 Web Vitals 회귀
- 알림 noise와 누락 검토

### 매월

- 달력 월 기준 오류 영향, 신규/해결 Issue, MTTR 검토
- 보관량, Replay 용량, sampling 조정
- 권한·Replay 열람·개인정보 게이트 감사 로그 검토
- SDK/Sentry 업그레이드와 보안 probe 계획

## 관련 문서

- [종합 설계와 기능별 판정](10-frontend-observability-design.md)
- [다른 프론트엔드 적용 Quick Guide](12-frontend-observability-quick-guide.md)
- [기존 Dashboard와 실제 수집 결과](06-dashboards.md)
- [개인정보·Relay 정책](07-security.md)
- [폐쇄망 운영](08-closed-network.md)
