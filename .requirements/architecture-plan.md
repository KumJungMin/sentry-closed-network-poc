# Phase 3 Architecture Plan

## Scope

`test-app/` 아래에 독립 실행 가능한 React + TypeScript + Vite 앱을 추가하고 Self-hosted Sentry의 `frontend-poc` 프로젝트에 연결한다.

## Existing Patterns Reused

- 저장소 루트의 비밀값 제외 규칙을 그대로 사용한다.
- Self-hosted Sentry의 주소는 `127.0.0.1:9000`을 사용한다.
- Phase 2에서 만든 운영 스크립트와 Docker 런타임은 수정하지 않는다.

## Component Boundaries

- `App.tsx`: 페이지 조립, 연결 상태와 최근 결과 상태 관리
- `components/TestActionCard.tsx`: 개별 테스트 설명과 실행 버튼
- `components/ExecutionLog.tsx`: 최근 실행 결과 목록
- `sentry/actions.ts`: 일곱 가지 Sentry 테스트 명령
- `sentry/client.ts`: SDK 초기화와 공개 연결 상태
- `types.ts`: UI와 명령이 공유하는 타입

## State Ownership

- 실행 중 테스트 ID와 실행 결과 목록은 `App`이 소유한다.
- Sentry scope, Tag, Context, Breadcrumb는 각 action 내부에서만 생성한다.
- SDK 초기화 여부는 `sentry/client.ts`의 불변 값으로 노출한다.

## Event Flow

1. 사용자가 `TestActionCard` 버튼을 누른다.
2. `App`이 실행 중 ID를 설정하고 대응하는 action을 호출한다.
3. action이 Sentry API 또는 테스트용 브라우저/API 동작을 수행한다.
4. action 결과를 `App`이 최근 실행 목록에 추가한다.
5. 비동기 작업은 성공 여부와 관계없이 실행 중 상태를 해제한다.

## Data Flow

- `VITE_SENTRY_DSN` → SDK 초기화
- `VITE_SENTRY_ENVIRONMENT` → Sentry environment
- `VITE_APP_RELEASE` → Sentry release
- action 반환값 → 화면의 실행 결과

## Error Handling

- 테스트 목적으로 발생한 API 실패는 잡은 뒤 `captureException`으로 전송한다.
- UI orchestration에서 예상하지 못한 오류는 결과 목록에 실패로 표시하고 다시 throw하지 않는다.
- 전역 오류 테스트만 의도적으로 `setTimeout` 안에서 throw한다.

## Accessibility Requirements

- 모든 버튼은 실제 `button` 요소와 명확한 이름을 사용한다.
- 실행 중에는 해당 버튼을 disabled 처리하고 상태 문구를 제공한다.
- 실행 결과는 `aria-live="polite"` 영역에서 알린다.
- 색상 외에 텍스트와 아이콘 기호로 상태를 구분한다.
- 키보드만으로 모든 테스트를 실행할 수 있어야 한다.

## Files To Change

- `test-app/package.json`
- `test-app/vite.config.ts`
- `test-app/eslint.config.js`
- `test-app/tsconfig*.json`
- `test-app/index.html`
- `test-app/.env.example`
- `test-app/src/**`
- `test-app/README.md`
- `docs/04-sdk-and-events.md`
- 루트 `README.md`

## Verification Plan

```bash
pnpm --dir test-app lint
pnpm --dir test-app typecheck
pnpm --dir test-app test --run
pnpm --dir test-app build
```

빌드 후 개발 서버를 `127.0.0.1:5173`에 열고 HTTP 응답과 화면 렌더링을 확인한다. 실제 이벤트 수집 검증은 Phase 4의 범위로 남긴다.

## Assumptions

- Node.js 22.18.0과 pnpm 10.14.0을 사용한다.
- 브라우저에서 React 앱과 Sentry 모두 같은 컴퓨터에서 실행한다.
- 실제 DSN은 사용자가 만든 `frontend-poc` 프로젝트의 값이다.
- 디자인 소스가 없으므로 학습용 도구 화면에 맞는 반응형 카드 UI를 자체 구성한다.
