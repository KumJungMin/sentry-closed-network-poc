# Phase 6: 대시보드 구성과 지원 범위 검증

## 목표

Self-hosted Sentry 26.8.0에서 실제로 저장되고 조회되는 데이터만 사용해 다음 영역을 대시보드로 구성한다.

- 프론트엔드 안정성: 전체 오류, 영향 사용자, 새 이슈, 미해결 이슈, 브라우저, 릴리스
- 업무 오류: channel, service, partner, currency, process_step, error_code
- API와 성능: HTTP 요청량·상태·지연, 느린 API, 페이지 로드, Web Vitals, Performance Score
- 기간별 오류: 24시간, 7일, 30일 오류·영향 사용자·Top N
- Tag와 Context의 검색·집계 차이

대시보드 API 문서뿐 아니라 설치된 26.8.0 이미지의 Frontend Overview, Outbound API Requests, Web Vitals 사전 구성에 사용된 필드와 쿼리를 확인했다. 모든 생성 요청은 `validateOnly=1` 검증을 통과한 뒤 저장했다.

## 생성한 대시보드

모든 대시보드는 `frontend-poc` 프로젝트를 범위로 저장했다. Dashboard 1~3은 최근 14일, 4~6은 제목의 기간을 기본값으로 사용한다.

| ID | 제목 | 위젯 수 | 주요 데이터셋 |
| --- | --- | ---: | --- |
| 1 | PoC - Frontend Stability | 6 | Errors, Issues |
| 2 | PoC - Business Error Breakdown | 6 | Errors |
| 3 | PoC - API and Frontend Performance | 9 | Spans |
| 4 | PoC - Errors Daily (24h) | 4 | Errors |
| 5 | PoC - Errors Weekly (7d) | 4 | Errors |
| 6 | PoC - Errors Monthly (30d) | 4 | Errors |

로컬 URL:

- `http://127.0.0.1:9000/organizations/sentry/dashboard/1/`
- `http://127.0.0.1:9000/organizations/sentry/dashboard/2/`
- `http://127.0.0.1:9000/organizations/sentry/dashboard/3/`
- `http://127.0.0.1:9000/organizations/sentry/dashboard/4/`
- `http://127.0.0.1:9000/organizations/sentry/dashboard/5/`
- `http://127.0.0.1:9000/organizations/sentry/dashboard/6/`

정의는 `scripts/phase6-dashboards.json`, 적용 명령은 `scripts/create-phase6-dashboards.sh`에 있다. 스크립트는 실제 토큰을 출력하지 않고 Git에서 제외된 `test-app/.env.sentry-build-plugin`을 읽는다. 같은 제목이 있으면 PUT update하고 없으면 POST create한다.

```bash
./scripts/create-phase6-dashboards.sh
```

## 프론트엔드 안정성 실제 결과

최근 14일, 프로젝트 ID 2를 기준으로 Events API와 Issues timeseries API를 조회했다.

| 지표 | 실제 결과 | 판정 |
| --- | ---: | --- |
| 전체 오류 이벤트 | 13 | 현재 버전에서 가능 |
| 고유 영향 사용자 | 0 | 집계 함수는 동작하지만 현재 이벤트의 user가 `null` |
| 미해결 고유 이슈 | 9 | `is:unresolved`와 `count_unique(issue)`로 가능 |
| 새 이슈 | 9 | Issue 위젯의 `count(new_issues)`로 가능 |
| 해결 이슈 | 0 | Issue 위젯의 `count(resolved_issues)`로 가능 |
| HeadlessChrome 오류 | 11 | `browser.name` 그룹 집계 가능 |
| Chrome 오류 | 2 | `browser.name` 그룹 집계 가능 |

릴리스별 오류는 다음과 같이 조회됐다.

| release | 오류 수 |
| --- | ---: |
| `frontend-poc@0.1.0` | 9 |
| `frontend-poc@0.1.0-with-sourcemap` | 3 |
| `frontend-poc@0.1.0-no-sourcemap` | 1 |

`is:new`은 Issues 검색에서는 유효하지만 Errors 데이터셋의 이벤트 검색에서는 거부됐다. 따라서 새 이슈 수는 오류 이벤트 쿼리로 흉내 내지 않고, 설치 버전의 공식 Frontend Overview와 같은 Issue 위젯 집계를 사용했다.

## 업무 Tag 실제 결과

빈 값은 `has:<tag>` 조건으로 제외하고 각 Tag를 개별 그룹 집계하도록 구성했다.

| Tag | 관찰된 값과 오류 수 | 판정 |
| --- | --- | --- |
| channel | `panda=1`, `hana-ez=1` | 현재 버전에서 가능 |
| service | `payment=1`, `remittance=1` | 현재 버전에서 가능 |
| partner | `bcel=1` | 현재 버전에서 가능 |
| currency | `USD=1` | 현재 버전에서 가능 |
| process_step | `payment-authorization=1` | 현재 버전에서 가능 |
| error_code | `PAYMENT_AUTH_FAILED=1` | 현재 버전에서 가능 |

업무 분류값은 Tag로 보낼 때 Errors 데이터셋의 차원으로 검색·그룹화할 수 있다. 실제 금액, 계좌번호, 수취인, 인증정보처럼 분석 대시보드에 불필요한 금융·개인정보는 Tag로 만들지 않는다.

## API와 프론트엔드 성능 실제 결과

Spans 데이터셋에는 총 271개 Span이 있었다.

| 지표 | 실제 결과 | 판정 |
| --- | ---: | --- |
| pageload Span | 11 | 현재 버전에서 가능 |
| 평균 pageload | 약 211.39ms | 현재 버전에서 가능 |
| P95 pageload | 약 374.22ms | 현재 버전에서 가능 |
| P75 LCP | 246ms | 현재 버전에서 가능 |
| P75 FCP | 246ms | 현재 버전에서 가능 |
| P75 INP | 32ms | 현재 버전에서 가능 |
| P75 TTFB | 16.125ms | 현재 버전에서 가능 |
| P75 CLS | 값 없음 | 기능은 가능하지만 현재 테스트에서 layout shift 표본이 없음 |
| Performance Score | 수식 저장·API 재조회 성공 | `performance_score(measurements.score.total)` 지원 |
| `span.op:http.client` | 0건 | 위젯은 지원하지만 현재 데이터로는 검증 불가 |

설치된 26.8.0의 공식 Outbound API Requests 구성은 `span.op:http.client`, `span.status_code`, `span.duration`, `sentry.normalized_description`을 사용한다. 같은 필드로 API 요청량, 평균 지연, 4XX·5XX 비율, 느린 API 위젯을 만들었지만 현재 PoC 이벤트에는 `http.client` Span이 없으므로 빈 차트가 정상이다.

다음 단계에서 API 지표를 채우려면 SDK가 실제 요청을 활성 Span 아래에서 기록하는지 확인하고, 필요하면 명시적 HTTP Span 계측을 추가해야 한다. 업무 오류 이벤트의 Breadcrumb 또는 Context에 적은 정제 문자열은 HTTP 성능 Span을 대신하지 않는다.

## Context 검색·집계 실험

Phase 5 이벤트 상세에는 `financial_webview_state.api_status=timeout`이 저장돼 있다. 같은 경로를 Errors Events API에 사용해 실제 동작을 확인했다.

| 실험 | 결과 |
| --- | --- |
| `financial_webview_state.api_status`를 그룹 필드로 요청 | 13건 모두 빈 문자열 그룹 |
| `financial_webview_state.api_status:timeout`으로 필터 | 0건 |
| 이벤트 상세에서 Context 확인 | `timeout` 표시 |

Context는 이벤트 한 건의 원인 분석에는 보이지만 검색·집계 차원이 아니다. 대시보드에서 필터링하거나 집계할 값은 Tag 또는 해당 기능의 정식 내장 필드로 보내야 한다. 동일 값을 Tag와 Context에 무조건 중복 저장하기보다는 검색 필요성, 개인정보 등급, cardinality를 먼저 결정한다.

## 지원 범위 분류

### 설치된 Self-hosted 26.8.0에서 바로 가능

- Errors 이벤트 수와 고유 Issue 수
- 미해결 Issue 필터
- Issue 위젯의 새 이슈·해결 이슈 시계열
- 브라우저, 릴리스, 커스텀 Tag별 오류 집계
- Span 기반 페이지 로드 지연
- LCP, FCP, INP, CLS, TTFB Web Vitals 집계
- Custom Dashboard 생성·편집 API

### 기능은 있으나 데이터 또는 설정이 더 필요

- 영향 사용자: 내부 HMAC `dbg_v1_*` 발급과 SDK/Relay allowlist를 구현했으며 실제 트래픽 연결 필요
- HTTP 실패·상태·평균 응답·느린 API: `http.client` Span 계측과 실제 API 트래픽이 필요
- CLS: layout shift가 발생하는 테스트 또는 실제 표본이 필요
- 장기 보관: Self-hosted의 retention, 디스크, ClickHouse 용량 정책을 별도로 결정해야 함

### 요청 범위에서 SaaS 전용으로 확인된 항목

- 없음

설치된 feature-complete Self-hosted 26.8.0 이미지 자체에 Frontend Overview, Outbound API Requests, Web Vitals 사전 대시보드 코드와 관련 API가 포함돼 있었다. 다만 공식 Self-hosted 안내는 feature-complete가 SaaS 기능의 “대부분”을 포함한다고 설명하며, Preview 기능은 기본 활성화되지 않을 수 있다. 따라서 다른 버전이나 새 기능은 매번 설치 버전의 feature flag와 실제 API로 재확인한다.

### Grafana 또는 BI가 더 적합한 범위

- Sentry 외 시스템과의 매출·거래·고객 데이터 조인
- 월·분기 단위 경영 KPI와 정형 보고서
- 원장 수준의 정확성이 필요한 금융 집계
- 많은 차원과 높은 cardinality를 가진 자유 분석
- Sentry 자체 컨테이너, Kafka, ClickHouse, PostgreSQL의 인프라 모니터링

Sentry Dashboard는 오류와 Trace를 배포·릴리스·코드 문맥에 연결해 진단하는 용도에 적합하다. 회사의 업무 통계 원장이나 범용 BI 저장소로 사용하지 않는다.

## 운영 중 관찰한 사항

검증 도중 nginx가 502를 반환했고 web worker가 비정상 종료 후 재생성되는 로그와 과거 OOM 흔적이 확인됐다. Kafka도 잠시 연결 거부 상태였다가 자동으로 healthy로 회복했다. 데이터 볼륨과 다른 서비스는 건드리지 않고 `web` 컨테이너만 재시작했으며, cold start 동안 약 1.26GiB를 사용한 뒤 healthy로 복구됐다.

이는 대시보드 기능 실패라기보다 로컬 단일 장비의 운영 여유와 health 관찰이 중요하다는 증적이다. 폐쇄망 운영에서는 Sentry UI만 보는 것으로 충분하지 않고 Docker/호스트 리소스와 Kafka·ClickHouse 상태를 별도 모니터링해야 한다.

## 검증 결과

### 성공

- 대시보드 JSON과 Bash 문법 검사 통과
- 33개 위젯이 포함된 대시보드 6개 모두 `validateOnly` 통과
- 대시보드 1~6 생성·업데이트 및 상세 API 재조회 성공
- 생성 스크립트 재실행 시 중복 없이 기존 ID update
- Dashboard 3 저장본에서 Performance Score 수식 확인
- Errors, Issues, Spans 실제 집계 응답 확인
- Context 검색·집계 불가를 실제 0건 응답으로 재현
- 토큰과 DSN을 출력하거나 대시보드 정의에 기록하지 않음

### 제한

- 현재 표본에 `http.client` Span이 없어 API 관련 위젯은 비어 있음
- user가 `null`이므로 영향 사용자 값은 0
- CLS 표본이 없어 P75 CLS는 값 없음
- 브라우저 자동 제어 모듈 호환 문제로 화면 픽셀 단위 자동 검증은 수행하지 못했으며, 저장 결과와 데이터는 API로 검증함

## 공식 참고 자료

- [Sentry Dashboard API](https://docs.sentry.io/api/dashboards/)
- [Sentry Explore Events API](https://docs.sentry.io/api/explore/query-explore-events-in-table-format/)
- [Sentry Explore Timeseries API](https://docs.sentry.io/api/explore/query-explore-events-in-timeseries-format/)
- [Sentry Issue Details의 Tags와 Contexts](https://docs.sentry.io/product/issues/issue-details/)
- [Sentry Issue 상태](https://docs.sentry.io/product/issues/states-triage/)
- [Self-hosted Sentry 안내](https://develop.sentry.dev/self-hosted/)
- [Self-hosted Sentry 저장소](https://github.com/getsentry/self-hosted)
