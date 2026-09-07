# Phase 5: 금융 WebView 사용자 지정 데이터 수집

## 목표

금융 WebView에서 업무 오류가 발생했다고 가정하고, 검색·집계할 값과 한 이벤트를 상세 분석할 값, 오류 이전의 흐름을 서로 다른 Sentry 데이터 구조로 보낸다.

- 검색·집계 후보: Tag
- 이벤트 한 건의 상세 상태: Context
- 오류 발생 전 시간순 흐름: Breadcrumb
- 배포 자체의 구분값: Sentry 내장 `environment`, `release`

실제 이름, 계좌번호, 금액, 수취인 원문, 토큰, API 요청·응답 원문은 입력받거나 전송하지 않는다.

## 화면과 동작

기존 7개 실험은 유지하고 `업무 데이터 직접 수집` 섹션을 추가했다. 다음 값을 선택한 뒤 하나의 고정된 업무 오류를 전송할 수 있다.

- channel: `hana-ez`, `bcel`, `panda`
- service: `remittance`, `payment`, `membership`
- partner: `bcel`
- currency: `KRW`, `LAK`, `USD`
- error_code
- page
- process_step: 수취인 검증, 결제 승인, 회원 검증
- authentication method
- retry count
- 정제된 API status
- 개인정보 없는 business state

오류 제목은 `[PoC] Financial WebView business error`로 고정했다. Tag 값이 달라도 오류 제목과 stack trace가 같으면 같은 Issue로 그룹화될 수 있고, 업무 분류는 Tag로 필터링한다.

## 데이터 분류표

| 데이터 | 예시 | 저장 위치 | 이유 |
| --- | --- | --- | --- |
| channel | `hana-ez`, `bcel`, `panda` | Tag | 채널별 오류 검색과 집계에 사용 |
| service | `remittance`, `payment`, `membership` | Tag | 서비스별 오류 검색과 집계에 사용 |
| partner | `bcel` | Tag | 제휴사별 검색과 향후 값 확장에 사용 |
| currency | `KRW`, `LAK`, `USD` | Tag | 통화별 오류 비교에 사용하며 실제 금액은 보내지 않음 |
| environment | `local`, `SIT`, `UAT`, `production` | 내장 필드 | SDK 초기화 시 배포 환경을 설정하며 이벤트 입력값으로 임의 변경하지 않음 |
| release | `frontend-poc@0.1.0` | 내장 필드 | 배포 버전별 비교를 위한 Sentry 기본 검색 필드 |
| error_code | `PAYMENT_AUTH_FAILED` | Tag | 오류 코드별 검색과 집계에 사용 |
| page | `payment-confirm` | Tag | 화면별 오류 검색과 집계에 사용 |
| process_step | `payment-authorization` | Tag | 업무 단계별 검색과 집계에 사용 |
| 현재 업무 단계 | `payment-authorization` | Context | 해당 이벤트를 분석할 때 현재 상태를 설명 |
| 인증 방식 | `biometric` | Context | 이벤트 상세 원인 분석에만 사용하며 사용자 인증값 자체는 보내지 않음 |
| 재시도 횟수 | `2` | Context | 개별 실패 당시 상태를 설명하는 숫자 |
| 정제된 API 상태 | `timeout` | Context | 응답 원문 대신 미리 정의한 상태만 보냄 |
| 개인정보 없는 업무 상태 | `awaiting-retry` | Context | 실제 거래정보 없이 상태만 설명 |
| 화면 진입부터 오류까지의 흐름 | 6개 단계 | Breadcrumb | 오류 직전 동작을 시간순으로 확인 |

Sentry 공식 문서와 설치된 26.8.0의 실제 동작에서 Tag는 인덱싱되어 검색할 수 있었다. Context는 이벤트 상세에는 표시되지만 검색할 수 없으므로, 대시보드 차원으로 집계해야 하는 값은 Context에만 두면 안 된다.

## Breadcrumb 구성

업무 흐름은 다음 순서로 저장한다.

1. 송금 화면 진입
2. 금액 입력 완료
3. 수취인 입력 완료
4. 수취인 검증 API 요청
5. 검증 실패
6. 오류 발생

금액 입력 단계에는 `currency`와 `amount_included=false`만 저장한다. 수취인 입력 단계에는 `recipient_data_included=false`만 저장한다. API는 실제 URL·본문 대신 `endpoint_alias=recipient-validation`, `method=POST`만 저장한다.

## 실제 검증 입력

| 필드 | 값 |
| --- | --- |
| channel | `panda` |
| service | `payment` |
| partner | `bcel` |
| currency | `USD` |
| error_code | `PAYMENT_AUTH_FAILED` |
| page | `payment-confirm` |
| process_step | `payment-authorization` |
| authentication method | `biometric` |
| retry count | `2` |
| API status | `timeout` |
| business state | `awaiting-retry` |

## Sentry 저장 결과

- 이벤트 ID: `44387889df8a43a89a5f84c1de24e709`
- Issue 그룹 ID: `9`
- environment: `local`
- release: `frontend-poc@0.1.0`
- 사용자 정보: `null`
- SDK envelope: HTTP 200
- SDK flush: 완료

Events API에서 `channel:panda service:payment`로 검색했을 때 위 이벤트 한 건이 반환됐다. 결과 열에는 `channel`, `service`, `partner`, `currency`, `error_code`, `page`, `process_step`의 선택값이 모두 그대로 표시됐다.

Context에는 `api_status=timeout`, `business_state=awaiting-retry`, `retry_count=2`, `contains_personal_data=false`가 저장됐다. 6개 Breadcrumb도 정의한 순서와 level로 저장됐다.

## 서버 기본 필터링 관찰

Self-hosted Sentry의 서버 측 데이터 정제 규칙은 다음 Context/Breadcrumb 값을 `[Filtered]`로 바꿨다.

- Context: `authentication_method`, `current_business_step`
- Breadcrumb data: `error_code`, `process_step`

동일한 `error_code`, `process_step` 값이 Tag에서는 원문으로 유지됐다. 필드가 저장되는 위치와 키 이름에 따라 서버 정제 결과가 달라질 수 있다는 뜻이다. 정확히 어떤 키를 허용하거나 추가로 제거할지는 Phase 7에서 회사 보안 정책과 함께 검증한다. 이번 단계에서는 기본 필터를 우회하지 않았다.

## 판정

### 성공

- 금융 WebView 사용자 지정 이벤트 입력 UI 추가
- 검색용 Tag 7개 전송 및 Events API 검색 성공
- Context에 정제된 상세 상태 저장
- 6단계 업무 Breadcrumb 순서 검증
- `environment`, `release` 내장 필드 유지
- 이벤트 사용자 정보 `null` 확인
- 금액·수취인·계좌번호·토큰·API 원문 미수집
- 데스크톱과 390px 모바일 레이아웃 확인
- 브라우저 콘솔·페이지 오류 없음

### 실패

- 기능 검증 실패 없음

### 추가 확인

- 서버 기본 필터가 Context/Breadcrumb의 일부 업무 키를 제거하는 정확한 규칙은 Phase 7에서 검증한다.
- Tag별 차트·집계와 Self-hosted 대시보드 위젯 지원 범위는 Phase 6에서 검증한다.
- 실제 사용자 수를 집계하려면 개인정보를 넣지 않는 비식별 사용자 ID 정책이 필요하며 Phase 7에서 결정한다.

## 구현 파일

- `test-app/src/custom-data/customData.core.ts`: 입력 검증, Tag/Context/Breadcrumb 매핑
- `test-app/src/custom-data/useCustomDataTest.ts`: 폼 상태, 격리 scope, 이벤트 전송과 flush
- `test-app/src/custom-data/CustomDataTestSection.tsx`: 입력 UI와 데이터 분류 안내
- `test-app/src/custom-data/*.test.ts*`: 순수 매핑과 사용자 흐름 테스트
- `test-app/src/App.tsx`, `test-app/src/App.css`: 새 섹션 조립과 반응형 스타일

## 공식 참고 자료

- [Sentry JavaScript 이벤트 보강](https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/)
- [Sentry Issue Details의 Tags와 Contexts](https://docs.sentry.io/product/issues/issue-details/)
- [Sentry JavaScript Breadcrumbs](https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/breadcrumbs/)
