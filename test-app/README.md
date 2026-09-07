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

브라우저에서 `http://127.0.0.1:5173/collection`에 접속합니다. `/`로 접속하면 Sentry 초기화 전에 `/collection`으로 정규화됩니다.

## 기능 URL

| 기능 | 경로 |
| --- | --- |
| 기본 이벤트 수집 | `/collection` |
| 사용자 지정 Tag·Context | `/custom-data` |
| 가입 퍼널 | `/signup-funnel` |
| 가입 - 약관 동의 | `/signup-funnel/terms` |
| 가입 - 계좌 인증 | `/signup-funnel/account` |
| 가입 - 휴대폰 인증 | `/signup-funnel/phone` |
| 가입 - CDD | `/signup-funnel/cdd` |
| 구조화 로그 | `/logs` |
| 서비스별 오류 | `/service-errors` |
| 가명 사용자 연결 | `/identity` |
| 개인정보 조회 게이트 | `/privacy` |
| 사용자 기준 지표 | `/metrics` |
| 보안 검증 | `/security` |
| 최근 실행 결과 | `/execution-log` |

라우팅은 `react-router-dom`의 `BrowserRouter`를 사용합니다. 별도 정적 서버에 배포할 때는 위 경로를 직접 요청해도 `index.html`을 반환하도록 SPA fallback을 설정해야 합니다.

가입 단계 URL에 진입하면 `page_view`가 자동 기록됩니다. 다음 단계 pageView 또는 완료 없이 30분이 지나면 이탈 확정이며, 그 전에는 이탈 판단 대기로 표시됩니다. 즉시 검수할 때는 `FUNNEL_DROPOFF_GRACE_PERIOD_MS=0 pnpm analytics`로 분석 서버를 실행합니다. 기존 `entered` 데이터도 계속 집계됩니다.

## 검증

```bash
pnpm lint
pnpm typecheck
pnpm exec vitest run
pnpm build
```

Relay 서버 방어와 원본 `user.id` 보존까지 재검증하려면 저장소 root에서 다음을 실행합니다.

```bash
./scripts/verify-phase7-data-scrubbing.sh --server-probe
./scripts/verify-phase7-data-scrubbing.sh --identity-probe
```
