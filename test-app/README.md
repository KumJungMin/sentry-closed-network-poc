# React Sentry 테스트 앱

Self-hosted Sentry의 오류, 메시지, Breadcrumb, Tag, Context, Span 수집을 버튼별로 확인하는 Phase 3 앱입니다.

## 환경 설정

```bash
cp .env.example .env.local
```

`.env.local`의 `VITE_SENTRY_DSN`을 Sentry `frontend-poc` 프로젝트 DSN으로 바꿉니다. 실제 DSN은 Git에 커밋하지 않습니다.

## 실행

```bash
pnpm install
pnpm dev
```

브라우저에서 `http://127.0.0.1:5173`에 접속합니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm test --run
pnpm build
```

이 Phase는 앱과 SDK 동작을 구현하는 범위입니다. 실제 이벤트가 Sentry 저장소까지 도달하고 UI에 표시되는지는 Phase 4에서 버튼별로 검증합니다.
