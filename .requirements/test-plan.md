# Phase 3 Test Plan

## Test Stack

- Vitest
- React Testing Library
- Testing Library User Event
- jsdom

## Unit Tests

- `captureException` action이 처리된 예외를 전송한다.
- `captureMessage` action이 warning 레벨 메시지를 전송한다.
- API 실패 action이 실패 응답을 예외로 전송한다.
- API 네트워크 실패 action이 원인을 예외로 전송한다.
- Breadcrumb action이 순서가 있는 세 항목과 예외를 전송한다.
- Tag/Context action이 격리된 scope에 값을 추가한다.
- 느린 작업 action이 `startSpan`과 span attribute를 사용한다.
- 전역 오류 action이 다음 이벤트 루프에서 오류를 발생시킨다.

## Component Tests

- 일곱 개 테스트 카드와 버튼이 렌더링된다.
- SDK 연결 여부와 environment/release가 표시된다.
- SDK 미연결 상태에서 DSN 설정 안내가 표시된다.
- 버튼 실행 후 최근 실행 결과가 표시된다.
- 비동기 action 실행 중 모든 테스트 버튼이 비활성화된다.
- action 자체 실패가 화면의 실패 결과로 표시된다.

## Integration Tests

- 이 Phase에서는 Sentry 서버까지의 실제 이벤트 수집 테스트를 자동화하지 않는다.
- Phase 4에서 브라우저 → Relay → Kafka/소비자 → 저장소 → Sentry UI 흐름을 검증한다.

## State Coverage

- SDK 연결됨/미연결
- 대기/실행 중/완료/예상된 실패
- 동기/비동기 action

## Mocking Strategy

- `@sentry/react`를 모킹해 외부 전송 없이 SDK 호출 인자를 검증한다.
- `fetch`를 모킹해 404 응답을 재현한다.
- fake timer로 전역 오류와 느린 작업 시간을 제어한다.

## Verification Commands

```bash
pnpm --dir test-app lint
pnpm --dir test-app typecheck
pnpm --dir test-app test --run
pnpm --dir test-app build
```

## Untested Risks

- Self-hosted 26.8.0의 이벤트 처리 파이프라인과 SDK 10.72.0의 실제 조합은 Phase 4에서 확인해야 한다.
- Source map을 아직 업로드하지 않으므로 production stack trace 가독성은 검증하지 않는다.
- 외부 네트워크 차단 상태의 SDK 재시도 동작은 Phase 8에서 검증한다.
