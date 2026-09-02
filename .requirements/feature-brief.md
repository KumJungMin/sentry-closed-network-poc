# Phase 3 Feature Brief

## Summary

Self-hosted Sentry의 React SDK 수집 기능을 학습하고 검증할 수 있는 독립적인 React 테스트 앱을 만든다.

## User Goal

사용자는 한 화면에서 일곱 가지 테스트를 명시적으로 실행하고, 각 동작이 어떤 Sentry 이벤트를 만드는지 즉시 이해할 수 있어야 한다.

## User Flows

1. 앱을 열어 Sentry 연결 상태와 현재 environment/release를 확인한다.
2. 테스트 카드의 버튼을 눌러 하나의 이벤트를 발생시킨다.
3. 화면의 최근 실행 결과에서 성공, 전송 요청, 예상된 실패를 확인한다.
4. Sentry의 `frontend-poc` 프로젝트에서 이벤트 상세를 확인한다.

## States

- SDK 연결됨: 유효한 `VITE_SENTRY_DSN`이 있다.
- SDK 미연결: DSN이 없으며 버튼은 실행되지만 원격 이벤트는 전송되지 않는다.
- 대기: 실행 중인 테스트가 없다.
- 실행 중: 비동기 API 실패 또는 느린 작업을 처리 중이다.
- 실행 완료: 최근 실행 시간과 설명을 표시한다.
- 예상된 실패: 테스트 목적으로 만든 API 실패를 표시한다.

## Events

1. 일반 JavaScript 오류를 전역 오류로 발생시킨다.
2. 처리된 `Error`를 `captureException`으로 전송한다.
3. 업무 경고를 `captureMessage`로 전송한다.
4. 존재하지 않는 API를 호출하고 실패 정보를 예외로 전송한다.
5. 업무 흐름 Breadcrumb 세 개를 추가한 뒤 예외를 전송한다.
6. 범위가 제한된 Tag와 Context를 추가한 뒤 예외를 전송한다.
7. 약 1.2초의 느린 작업을 사용자 지정 Span으로 측정한다.

## Validation Rules

- DSN은 코드에 하드코딩하지 않고 `VITE_SENTRY_DSN`으로만 받는다.
- environment 기본값은 `local`, release 기본값은 `frontend-poc@0.1.0`이다.
- 이메일, 전화번호, 계좌번호, 토큰, 요청·응답 원문을 테스트 데이터에 넣지 않는다.
- 이벤트별 Tag와 Context는 다른 이벤트로 누출되지 않도록 `withScope` 안에서 설정한다.
- 한 번에 같은 비동기 버튼을 중복 실행할 수 없다.

## Edge Cases

- Sentry 서버가 꺼져 있어도 앱 UI는 동작하고 브라우저 콘솔에서 전송 실패를 확인할 수 있다.
- 존재하지 않는 API가 예상과 달리 2xx를 반환하면 명시적인 테스트 오류를 만든다.
- 일반 JavaScript 오류는 앱 전체를 깨뜨리지 않도록 다음 이벤트 루프에서 발생시킨다.
- 느린 작업 도중 오류가 나면 실행 상태를 반드시 해제한다.

## Non-Goals

- Source map 업로드와 전후 비교는 Phase 4에서 수행한다.
- 금융 업무용 커스텀 데이터 전체 모델은 Phase 5에서 구현한다.
- 개인정보 정제 정책의 완전한 구현은 Phase 7에서 수행한다.
- Session Replay, Logs, Application Metrics는 이번 Phase에서 활성화하지 않는다.

## Acceptance Criteria

- 한 화면에 요구된 일곱 개 테스트와 각 기능 설명이 표시된다.
- DSN이 있을 때 Self-hosted Sentry로 이벤트를 전송한다.
- SDK 미연결 상태를 사용자가 화면에서 구분할 수 있다.
- 비동기 테스트는 실행 중 상태와 결과를 표시한다.
- 실제 `.env.local`은 Git에서 제외되고 `.env.example`만 공유된다.
- lint, typecheck, unit test, production build가 모두 통과한다.
