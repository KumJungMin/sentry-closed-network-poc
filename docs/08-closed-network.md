# Phase 8: 폐쇄망 축소 테스트

- 검증일: 2026-09-02 (Asia/Seoul)
- Self-hosted Sentry: `26.8.0`
- 프로젝트: `sentry / frontend-poc`
- 최종 판정: 핵심 오류 수집·조회 기능은 외부망 없이 동작

## 검증 경계

호스트의 Wi-Fi를 끄는 방식은 작업 연결과 다른 애플리케이션까지 함께 끊고, 무엇이 차단됐는지 증명하기도 어렵다. 이번 PoC는 Docker 네트워크를 다음처럼 분리해 Sentry 서버의 외부 통신 실패를 실제로 만들었다.

```text
호스트 브라우저 · React SDK · sentry-cli
                 │ 127.0.0.1:9000
                 ▼
      phase8-ingress ── nginx 한 대만 연결
                 │
                 ▼
      default(internal=true, 외부 라우팅 없음)
        ├─ Relay / Web / Worker
        ├─ PostgreSQL / ClickHouse
        ├─ Kafka / Redis / Memcached
        └─ Symbolicator / SeaweedFS 등
```

- `default`: Sentry의 57개 컨테이너가 통신하는 내부 전용망이다. Docker가 외부 라우팅을 만들지 않는다.
- `phase8-ingress`: 호스트에서 공개 포트로 들어오기 위한 망이다. nginx 하나만 연결했다.
- 호스트 자체는 인터넷에서 분리하지 않았다. 따라서 이번 결과는 **Sentry 서버 영역의 egress(밖으로 나가는 통신) 차단 검증**이며, 회사 적용 시에는 사용자 PC와 서버 VLAN의 방화벽 정책을 별도로 검증해야 한다.

격리 설정은 `scripts/phase8-closed-network.override.yml`에 있으며 데이터 볼륨 설정은 바꾸지 않는다.

## 실제 검증 결과

| 요구사항 | 실행한 검증 | 결과 |
| --- | --- | --- |
| 실제 외부 통신 실패 | `web` 컨테이너에서 `1.1.1.1:443` TCP 연결 | 실패, `[Errno 101] Network is unreachable` |
| 내부 통신 성공 | `web → postgres:5432` DNS 및 TCP 연결 | 성공 |
| Sentry 화면 진입점 | 호스트에서 `http://127.0.0.1:9000/_health/` | HTTP 200 |
| 새 오류 수집 | 격리 중 합성 오류 envelope 전송 | 성공 |
| 오류 상세 조회 | 프로젝트 Event Details API에서 제목과 Tag 검증 | HTTP 200 |
| Source map 업로드 | 로컬 Vite build → Debug ID 주입 → 로컬 Sentry 업로드 | 성공 |
| Docker 재시작 | 격리 상태에서 57개 컨테이너 전체 재시작 | 성공 |
| 재시작 후 기존 데이터 | 재시작 전 이벤트 상세 재조회 | 성공 |
| 재시작 후 새 오류 | 재시작 뒤 두 번째 합성 오류 전송·조회 | 성공 |
| 일반망 복구 | 격리 Compose 종료 후 기본 Compose 기동 | 성공, `internal=false` |
| 복구 후 데이터 | 최종 이벤트 상세 재조회 | 성공 |
| 프론트엔드 패키지 캐시 | `pnpm install --offline --frozen-lockfile` | 성공 |

검증 이벤트는 모두 고정된 합성 데이터만 사용했다.

- 재시작 전 이벤트: `1c4689b13b73f46006c3ba4d62610330`
- 재시작 후·최종 이벤트: `7cde30df7a404b3ad9d50b2683c7cb3e`
- 최종 이벤트 화면: `http://127.0.0.1:9000/organizations/sentry/issues/?query=7cde30df7a404b3ad9d50b2683c7cb3e`
- Source map Debug ID: `53eabd31-e0f1-5112-bee0-2af39883a554`
- 최초 artifact bundle ID: `5c8316ae-11e7-533b-9f3b-13b2303f0a13`

Source map 재업로드에서는 동일한 Debug ID bundle이 이미 서버에 있어 `Nothing to upload`가 반환됐다. 이는 CLI가 외부 SaaS가 아니라 내부 Sentry 저장본을 확인했다는 뜻이다. 공식 권장 흐름과 같이 production build에 Debug ID를 먼저 주입한 뒤 이벤트 발생 전에 업로드했다.

## 재현 명령

프로젝트 루트에서 실행한다.

```bash
# 1. Sentry 서버의 외부망 차단
./scripts/phase8-network.sh isolate

# 2. 경계만 빠르게 재검증
./scripts/phase8-network.sh probe

# 3. Source map, 신규 오류, 상세 조회 검증
./scripts/verify-phase8-closed-network.sh

# 4. 격리 상태 전체 재시작과 기존 이벤트 재조회
./scripts/phase8-network.sh restart-isolated
./scripts/verify-phase8-closed-network.sh --recheck

# 5. 일반 네트워크로 안전하게 원복
./scripts/phase8-network.sh restore
./scripts/verify-phase8-closed-network.sh --recheck
```

`down -v`를 사용하지 않으므로 PostgreSQL, ClickHouse, Kafka, SeaweedFS 등 기존 볼륨은 보존된다. 중간에 실패하면 `./scripts/phase8-network.sh restore`로 원복한다.

## 인터넷 없이 사용할 수 있는 범위

다음 기능은 Sentry와 SDK가 같은 내부망에 있고 필요한 이미지·패키지가 이미 반입됐다는 전제에서 동작한다.

- 기존 계정 로그인과 프로젝트 설정 조회
- 브라우저 SDK의 오류·Message·Breadcrumb·Tag·Context 전송
- Issue 목록, 검색, grouping, 오류 상세와 Stack trace 조회
- Transaction/Span 수집과 기존 대시보드 조회
- 내부 Sentry API를 통한 Source map 업로드
- 내부에 업로드한 Source map을 이용한 JavaScript Stack trace 복원
- 로컬 PostgreSQL·ClickHouse·SeaweedFS에 저장된 데이터 유지

## 외부 연동이 없을 때의 제한

| 기능 | 폐쇄망 영향 | 기본 오류 수집 영향 |
| --- | --- | --- |
| SMTP | 외부 SMTP relay가 없으면 초대, 알림, 비밀번호 재설정 메일을 전달할 수 없음 | 없음. 기존 계정 로그인과 오류 조회는 가능 |
| Slack | OAuth와 Slack API에 접근할 수 없어 설치·채널 알림·상호작용 불가 | 없음 |
| GitHub | GitHub App/OAuth/API에 접근할 수 없어 commit, suspect commit, Issue 연동 제한 | 없음 |
| 외부 Debug symbol | Symbolicator가 외부 symbol server에 접근할 수 없으면 해당 네이티브 심볼 해석 제한 | JavaScript의 내부 업로드 Source map은 가능 |
| GeoIP | GeoLite DB를 별도 반입하지 않으면 IP 기반 도시 정보 없음 | 없음 |
| Uptime/Crons 대상 | 외부 URL 감시는 실패하며 내부 URL만 감시 가능 | 오류 Issue 수집과는 별개 |
| AI·외부 SaaS 기능 | 공급자 API가 필요한 기능은 사용할 수 없음 | 없음 |

이번 설정에서 `mail.host`는 내부 `smtp` 컨테이너를 가리키지만, 최종 수신자까지 전달할 외부 또는 사내 SMTP relay는 구성하지 않았다. Slack과 GitHub 설정도 주석 상태다. 따라서 이번 PoC의 성공 범위는 오류 관찰 핵심 기능이며 외부 알림과 협업 연동은 포함하지 않는다.

## 온라인 상태에서 먼저 반입할 항목

### Sentry 서버

1. 고정된 Self-hosted 소스
   - 릴리스 `26.8.0`, 커밋 `73fe2f2747800873f0896aec283c45b6dcf34432`
2. Docker Desktop/Engine과 Compose, Bash 4.4 이상
3. Compose가 참조하는 모든 이미지와 로컬 빌드 기반 이미지
   - Sentry, Relay, Snuba, Symbolicator, Taskbroker, Vroom, Launchpad, Uptime Checker
   - PostgreSQL, Kafka, Valkey, Memcached, nginx, PgBouncer, SeaweedFS, SMTP
   - ClickHouse 기반 이미지와 로컬 빌드 결과
4. 설치 중 추가로 내려받는 파일과 OS 패키지
   - `https://github.com/getsentry/sentry-nodestore-s3/archive/main.zip`
   - SeaweedFS bootstrap의 Alpine `s3cmd`
   - 기존 profile 마이그레이션이 필요할 때 Debian `s3cmd`
   - `SETUP_JS_SDK_ASSETS=1`일 때 `browser.sentry-cdn.com`의 브라우저 SDK
5. 조직의 내부 CA 인증서와 DNS/HTTPS 설정 파일

특히 `sentry-nodestore-s3`가 GitHub의 움직이는 `main.zip`을 참조하는 점은 폐쇄망 재현성과 공급망 관리에 부적합하다. 회사 반입본에서는 검증한 커밋 또는 내부 artifact로 고정하고 해시를 기록해야 한다.

### 프론트엔드와 CI

- Node.js, pnpm 실행 파일과 `pnpm-lock.yaml`
- lockfile에 고정된 전체 pnpm store 또는 사내 npm registry
- `@sentry/react`와 `@sentry/cli` 패키지 및 CLI용 플랫폼 바이너리
- 빌드 대상 소스, `.env` 템플릿, 내부 Sentry CA
- Source map 업로드용 최소 권한 토큰을 보관할 CI Secret

현재 컴퓨터에서는 pnpm store만으로 `--offline --frozen-lockfile` 설치가 성공했다. 새 PC나 폐쇄망 CI에서는 `node_modules`가 아니라 lockfile과 검증된 package store/사내 registry를 함께 반입해야 한다.

## 설치와 실행의 차이

- **최초 설치·업데이트**는 이미지 registry, GitHub, Alpine/Debian package repository 등에 의존한다. 온라인 구간에서 모두 내려받고 스캔·서명·해시 검증 후 반입해야 한다.
- **이미 설치된 버전의 재기동**은 `pull_policy: never`와 로컬 이미지/볼륨만으로 가능했다.
- **일상 오류 수집과 조회**는 SDK의 DSN, 사용자의 Sentry URL, Source map 업로드 URL이 모두 내부 주소라면 외부 인터넷을 요구하지 않았다.

운영에서 재설치까지 보장하려면 Docker 이미지만 저장해서는 부족하다. 소스, 기반 이미지, 설치 중 OS 패키지, 프론트엔드 package store, 내부 인증서와 설정을 하나의 검증된 반입 묶음으로 관리해야 한다.

## 관찰된 주의점

1. 57개 서비스를 동시에 재시작하면 Apple Silicon 6코어/약 15.6GiB Docker 할당 환경에서 Kafka와 Web이 준비되기까지 수 분이 걸렸다. 준비 중 nginx는 일시적으로 HTTP 502를 반환했다가 자동 복구했다.
2. 재시작 중 Relay의 Web/Kafka 연결 거부 로그가 발생했다. 이는 외부망 실패가 아니라 내부 의존 서비스가 아직 준비되지 않은 시간대의 로그다. 재기동 후 신규 이벤트 저장으로 최종 복구를 확인했다.
3. Symbolicator의 DogStatsD 연결 거부 로그가 반복됐다. 선택적 metrics 수신기가 구성되지 않은 문제이며 JavaScript Source map 업로드와 오류 수집은 성공했다.
4. 로그인된 Chrome 자동 제어 연결이 로컬 모듈 오류로 실패해 UI 자동 클릭 증거는 만들지 못했다. 대신 공개 웹 진입점 HTTP 200, 인증된 Event Details API, 이벤트 저장소를 교차 검증했고 수동 확인 URL을 남겼다.
5. nginx는 호스트 포트 공개를 위해 비격리 진입망에도 연결된다. 회사 환경에서는 nginx의 outbound도 방화벽으로 막고, 내부 사용자/SDK에서 nginx 방향의 inbound만 허용해야 한다.

## 판정

이 PoC에서는 외부 IP 통신이 실제로 실패하는 동안 Sentry 화면 진입점, Source map 업로드, 새 오류 수집, 오류 상세 조회, 전체 Docker 재시작과 데이터 복구가 모두 성공했다. 따라서 **필요한 설치물과 프론트엔드 패키지를 미리 반입하고 내부 DNS/HTTPS/DSN을 구성하면 핵심 Sentry 기능은 폐쇄망 안에서 독립적으로 사용할 수 있다.**

다만 SMTP·Slack·GitHub·외부 symbol/GeoIP처럼 외부 서비스나 데이터에 의존하는 기능은 별도의 사내 대체 경로 또는 허용 정책이 필요하다.

## 공식 참고 자료

- [Sentry Self-hosted 문서](https://develop.sentry.dev/self-hosted/)
- [Sentry JavaScript Source map 문제 해결](https://docs.sentry.io/platforms/javascript/sourcemaps/troubleshooting_js/)
- [Sentry Self-hosted 이메일 설정](https://develop.sentry.dev/self-hosted/configuration/email/)
- [Sentry GitHub Integration 설정](https://develop.sentry.dev/integrations/github/)
- [Sentry Slack Integration 설정](https://develop.sentry.dev/integrations/slack/)
