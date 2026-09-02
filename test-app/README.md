# React Sentry 테스트 앱

Self-hosted Sentry의 오류, Logs, Breadcrumb, Tag, Trace, Replay, Web Vitals와 망 내부 퍼널·가명 사용자·JIT 개인정보 조회를 함께 검증하는 프론트 디버깅 실험 앱입니다.

## 환경 설정

```bash
cp .env.example .env.local
```

`.env.local`의 `VITE_SENTRY_DSN`을 Sentry `frontend-poc` 프로젝트 DSN으로 바꿉니다. 실제 DSN은 Git에 커밋하지 않습니다.

로컬 PoC에서는 Replay가 활성화되며 모든 텍스트·입력·미디어가 마스킹됩니다. `data-sentry-block` 또는 `data-private` 속성이 붙은 영역은 통째로 녹화에서 제외됩니다. 운영 환경은 `VITE_SENTRY_REPLAY_ENABLED=true`를 명시하기 전까지 Replay가 꺼집니다.

## 실행

```bash
pnpm install
pnpm analytics  # 터미널 1: 정확한 가입 퍼널 집계
pnpm dev        # 터미널 2: 테스트 앱
```

브라우저에서 `http://127.0.0.1:5173`에 접속합니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm exec vitest run
pnpm build
```

Relay 서버 방어와 가명 ID 보존까지 재검증하려면 저장소 root에서 다음을 실행합니다.

```bash
./scripts/verify-phase7-data-scrubbing.sh --server-probe
./scripts/verify-phase7-data-scrubbing.sh --identity-probe
```
