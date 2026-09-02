# Phase 2: Self-hosted Sentry 설치 및 운영

- 설치일: 2026-08-30 (Asia/Seoul)
- 고정 버전: `26.8.0`
- 공식 커밋: `73fe2f2747800873f0896aec283c45b6dcf34432`
- 소스: `https://github.com/getsentry/self-hosted.git`
- 프로필: `feature-complete`
- 플랫폼: `linux/arm64`
- 로컬 소스 위치: `.runtime/self-hosted` (프로젝트 Git에서 제외)

## 설치 전 상태

| 항목 | 결과 |
| --- | --- |
| Docker Desktop | 4.88.1 (기존 설치 앱 발견) |
| Docker Engine | 29.7.2 |
| Docker Compose | 5.4.0 |
| Docker CPU | 6코어 |
| Docker RAM | 16,746,352,640 bytes, 약 15.6GiB |
| Docker 아키텍처 | `aarch64` |
| Homebrew Bash | 5.3.15 (`/opt/homebrew/bin/bash`) |
| 기존 컨테이너 | 0 |
| 기존 이미지 | 0 |
| 기존 볼륨 | 0 |
| 기존 빌드 캐시 | 0B |
| TCP 9000 | 설치 전 미사용 |

공식 설치 스크립트가 Feature-complete 프로필에서 검사하는 최소값은 Docker CPU 4코어, RAM 14,000MB, Bash 4.4, Docker 19.03.6, Compose 2.32.2입니다. 현재 환경은 모두 충족합니다.

## 도구 준비 중 확인한 사항

1. macOS 기본 Bash 3.2는 변경하지 않고 Homebrew Bash 5.3.15를 추가했습니다.
2. Bash 설치 과정에서 직접 의존성인 `readline`, `libunistring`, `gettext`가 Homebrew 최신 버전으로 올라갔습니다.
3. `brew update` 중 과거 `pkg-config`와 새 `pkgconf`의 링크 충돌이 발생했습니다. 기존 `pkg-config` 링크를 유지했고 강제 덮어쓰지 않았습니다. Sentry 설치 요구사항과는 무관하지만 별도 Homebrew 정비 대상으로 남깁니다.
4. Docker Desktop을 Homebrew로 설치하려 했을 때 동일 버전 앱이 이미 `/Applications/Docker.app`에 있어 중단됐습니다. 기존 앱은 4.88.1, ARM64, Docker Team ID `9BNSXJN65R`로 확인되어 강제 재설치하지 않고 그대로 사용했습니다.

## 설치 전 Compose 분석

Feature-complete Compose 설정에는 57개 서비스가 있습니다. 여러 소비자가 같은 이미지를 재사용하므로 서비스 수와 다운로드 이미지 수는 다릅니다.

### Compose에 직접 표시되는 이미지

```text
chrislusf/seaweedfs:4.40_large_disk@sha256:d07aa1dae03c687e0737b86130ded1b18474211a09e85d737fbe5508b8805139
clickhouse-self-hosted-local                         # 로컬 빌드 결과
confluentinc/cp-kafka:7.6.6
edoburu/pgbouncer:v1.25.2-p0
ghcr.io/getsentry/launchpad:26.8.0
ghcr.io/getsentry/relay:26.8.0
ghcr.io/getsentry/snuba:26.8.0
ghcr.io/getsentry/symbolicator:26.8.0
ghcr.io/getsentry/taskbroker:26.8.0
ghcr.io/getsentry/uptime-checker:26.8.0
ghcr.io/getsentry/vroom:26.8.0
memcached:1.6.45-alpine
nginx:1.31.3-alpine
postgres:14.23-bookworm
registry.gitlab.com/egos-tech/smtp
sentry-cleanup-self-hosted-local                     # 로컬 빌드 결과
sentry-self-hosted-local                             # 로컬 빌드 결과
valkey/valkey:8.1.9-alpine
```

### 로컬 빌드가 추가로 요구하는 항목

- `ghcr.io/getsentry/sentry:26.8.0`: Sentry 로컬 이미지의 기반 이미지
- `altinity/clickhouse-server:25.3.6.10034.altinitystable`: ClickHouse 로컬 이미지의 기반 이미지
- `https://github.com/getsentry/sentry-nodestore-s3/archive/main.zip`: Sentry Dockerfile이 빌드 중 설치하는 Python 패키지

마지막 GitHub `main.zip` 의존성은 릴리스 태그로 고정되지 않은 외부 네트워크 의존입니다. Phase 8의 폐쇄망 반입 목록에서 반드시 별도로 고정·검증해야 합니다.

## 설치 명령

```bash
cd .runtime/self-hosted
DOCKER_PLATFORM=linux/arm64 \
  /opt/homebrew/bin/bash ./install.sh \
  --no-report-self-hosted-issues \
  --skip-user-creation
```

- `DOCKER_PLATFORM=linux/arm64`: Apple Silicon용 Linux 이미지를 사용합니다.
- `/opt/homebrew/bin/bash`: 공식 최소 버전을 만족하는 Bash로 스크립트를 실행합니다.
- `--no-report-self-hosted-issues`: 설치 오류와 설치 로그를 외부 Sentry로 자동 전송하지 않습니다.
- `--skip-user-creation`: 설치 중 계정 비밀번호가 자동화 로그에 섞이지 않도록 관리자 생성을 분리합니다.

설치 스크립트는 이미지를 내려받고, 로컬 이미지를 빌드하고, Docker 볼륨과 설정 파일을 만들고, PostgreSQL·ClickHouse/Snuba 마이그레이션을 실행합니다. 설치 중 일부 임시 컨테이너가 시작되고 종료될 수 있습니다.

## 영향과 복구 원칙

- 정상 중지: 소스 디렉터리에서 `docker compose down`
- 다시 시작: 소스 디렉터리에서 `docker compose up -d --wait`
- 상태 조회: `docker compose ps`
- 로그 조회: `docker compose logs --tail=200 <service>`
- `docker compose down -v`는 데이터 볼륨을 삭제하므로 사용하지 않습니다.
- `docker system prune`, 이미지 강제 삭제, Docker Desktop 공장 초기화도 사용하지 않습니다.
- 실패 시 원인을 확인할 때까지 생성된 컨테이너·볼륨을 보존합니다.

## 설치 결과

공식 설치 스크립트와 전체 스택 기동이 성공했습니다.

```text
설치 스크립트 종료 코드: 0
Compose 기동 결과: 60/60 완료
실행 컨테이너: 57개
웹 진입점: http://127.0.0.1:9000/
로그인 화면 최종 응답: HTTP 200
헬스 엔드포인트: ok, HTTP 200
```

설치 스크립트는 다음 작업을 완료했습니다.

- PostgreSQL 애플리케이션 스키마 마이그레이션
- ClickHouse/Snuba 데이터 스키마 마이그레이션
- 내부 기본 프로젝트 생성
- Relay 인증 정보와 Sentry secret key 생성
- SeaweedFS에 이벤트 첨부물용 버킷과 프로파일용 버킷 생성
- 로컬 ARM64 이미지 빌드

관리자 계정은 설치 로그에 비밀번호가 남지 않도록 설치 중 생성을 건너뛴 뒤, 공식 CLI로 별도 생성했습니다. 계정은 `admin@sentry-poc.local`이며 실제 비밀번호는 문서나 Git에 기록하지 않습니다.

### 설치 직후 Docker 사용량

| 구분 | 개수 | 사용량 |
| --- | ---: | ---: |
| 이미지 | 21 | 10.95GB |
| 실행 컨테이너 | 57 | 66.35MB writable layer |
| 로컬 볼륨 | 18 | 1.955GB |
| 빌드 캐시 | 50 | 802.1MB |

이미지·볼륨·빌드 캐시를 합치면 설치 직후 약 13.7GB이며, 이후 이벤트와 로그가 쌓이면 증가합니다. 유휴 상태에서 57개 컨테이너의 표시 메모리를 단순 합산하면 약 13.0GiB였습니다. 이는 Docker Desktop에 할당된 약 15.6GiB에 가까우므로 테스트하지 않을 때는 스택을 중지하는 편이 안전합니다.

### 확인된 제한과 주의점

1. GeoIP 데이터베이스를 내려받지 못해 `GeoLite2-City.mmdb`가 빈 파일로 생성됐습니다. IP 기반 도시 정보가 필요할 때 별도 설정이 필요하지만 오류 수집 핵심 기능에는 영향을 주지 않습니다.
2. Codex 내장 브라우저 연결은 로컬 런타임의 모듈 제한으로 시작되지 않았습니다. 대신 호스트 HTTP 응답을 검증하고 기본 브라우저에 초기 등록 화면을 열었습니다.
3. Compose의 SMTP 컨테이너는 포함돼 있지만 실제 외부 메일 발송은 구성하지 않았습니다. 폐쇄망 기본 PoC에서는 이메일 초대나 비밀번호 재설정을 전제로 하지 않습니다.
4. 설치용 Dockerfile이 `sentry-nodestore-s3`의 GitHub `main.zip`을 사용합니다. 폐쇄망 재설치를 위해 Phase 8에서 이 의존성을 고정하고 반입물로 관리해야 합니다.

## 운영 스크립트

프로젝트 루트에서 다음 명령을 사용합니다.

```bash
./scripts/sentry.sh status
./scripts/sentry.sh health
./scripts/sentry.sh start
./scripts/sentry.sh stop
./scripts/sentry.sh restart
./scripts/sentry.sh logs web
```

- `status`: 컨테이너 상태 조회
- `health`: 웹 헬스 엔드포인트 확인
- `start`: 기존 볼륨을 연결해 전체 스택 기동
- `stop`: 컨테이너와 Compose 네트워크만 내리고 데이터 볼륨은 보존
- `restart`: 안전한 `stop` 후 `start`
- `logs <service>`: 지정 서비스의 최근 200줄 확인

`stop` 뒤에도 PostgreSQL, ClickHouse, Kafka, SeaweedFS 등의 데이터는 Docker 볼륨에 남습니다. 볼륨까지 지우는 `docker compose down -v`는 복구 목적이 아닌 한 실행하지 않습니다.

## 최초 관리자와 테스트 프로젝트

1. `http://127.0.0.1:9000/auth/login/sentry/`에 접속합니다.
2. `admin@sentry-poc.local`과 별도로 전달된 임시 비밀번호로 로그인합니다.
3. 로그인 직후 임시 비밀번호를 새 비밀번호로 변경합니다.
4. 기본 조직 `sentry`를 사용합니다.
5. 프로젝트 플랫폼은 Phase 3에서 사용할 `React`를 선택합니다.
6. 프로젝트 이름은 `frontend-poc`로 정합니다.
7. 발급된 DSN은 이후 실제 `.env`에만 넣고 Git에 커밋하지 않습니다.

### 최초 설정 검증 결과

| 항목 | 결과 |
| --- | --- |
| 관리자 | `admin@sentry-poc.local`, 활성 슈퍼유저 |
| 조직 | `sentry` |
| 사용자 프로젝트 | `frontend-poc` |
| 프로젝트 플랫폼 | `javascript-react` |
| 내부 시스템 프로젝트 | `internal` |
| 웹 헬스체크 | `ok` |

브라우저에서 로그인과 React SDK 설정 화면 진입을 확인했고, 데이터베이스에서도 관리자·조직·프로젝트 생성을 읽기 전용으로 검증했습니다. DSN 원문과 비밀번호는 저장소 문서에 기록하지 않았습니다.
