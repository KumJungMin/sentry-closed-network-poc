# Phase 0: 환경 및 요구사항 점검

- 점검일: 2026-08-30 (Asia/Seoul)
- 작업 위치: `/Users/gjm/sentry-closed-network-poc`
- 점검 범위: 읽기 전용 시스템 조회, 공식 문서 확인, 프로젝트 기본 문서 생성
- 하지 않은 작업: Docker 설치, 이미지 다운로드, 컨테이너 실행, 포트 변경, 기존 Docker 자원 변경

## 한눈에 보는 결론

이 Mac의 물리 사양은 Self-hosted Sentry PoC를 수행하기에 충분합니다. CPU 12코어, 메모리 32GB, 빈 디스크 약 549GiB로 공식 권장치인 CPU 4코어, 메모리 16GB, 빈 디스크 20GB를 넘습니다.

그러나 지금 바로 설치할 수는 없습니다.

1. Docker Desktop과 `docker` 명령이 설치되어 있지 않습니다.
2. macOS 기본 Bash는 3.2.57이며 Sentry 26.8.0 설치 스크립트가 요구하는 Bash 4.4보다 낮습니다.
3. Apple M2 Max는 ARM64 CPU이므로 Phase 2에서 이미지 아키텍처를 `linux/arm64`로 명시하고, 모든 이미지가 정상 실행되는지 실제 검증해야 합니다.

## 측정 결과

| 항목 | 확인 결과 | 판단 |
| --- | --- | --- |
| 운영체제 | macOS 15.6.1 (Darwin 24.6.0) | PoC 호스트로 사용 가능 |
| 컴퓨터 | MacBook Pro, Apple M2 Max | Apple Silicon/ARM64 주의 필요 |
| CPU | 12코어 (성능 8 + 효율 4) | 공식 권장 4코어 이상 |
| 메모리 | 32GB | 공식 권장 16GB 이상 |
| 디스크 | 총 926GiB, 여유 약 549GiB | 공식 권장 여유 20GB 이상 |
| Docker CLI | 없음 | 설치 필요 |
| Docker Desktop 앱 | `/Applications`와 사용자 Applications에 없음 | 설치 필요 |
| Docker Compose | 없음 | Docker Desktop과 함께 준비 필요 |
| Git | 2.45.1 | 사용 가능 |
| Node.js | 22.18.0 | 테스트 앱에 사용 가능 |
| npm | 10.9.3 | 사용 가능 |
| pnpm | 10.14.0 | 사용 가능, 테스트 앱 패키지 관리자로 권장 |
| macOS 기본 Bash | 3.2.57 | 공식 최소 4.4 미달 |
| zsh | 5.9 | 대화형 명령 실행에 사용 가능하지만 설치 스크립트의 Bash 요구를 대체하지 않음 |
| Homebrew | 4.3.3 | 최신 Bash 준비 시 사용 가능 |
| TCP 9000 포트 | 수신 중인 프로세스 없음 | Sentry 기본 포트 사용 가능 |
| 저장소 | 빈 Git 저장소, 기존 작업 파일 없음 | 새 PoC 구조와 충돌 없음 |
| Git 원격 저장소 | `KumJungMin/sentry-closed-network-poc` | 비밀값 커밋 방지 필요 |

### 용어 설명

- **호스트(host)**: Docker를 실행하는 실제 컴퓨터, 여기서는 이 MacBook입니다.
- **ARM64**: Apple Silicon이 사용하는 CPU 명령 체계입니다. 서버에서 흔한 x86_64 이미지와 형식이 달라 이미지별 호환성 확인이 필요합니다.
- **Docker Desktop**: macOS 위에 작은 Linux 가상 환경을 만들고 그 안에서 Linux 컨테이너를 실행하는 앱입니다.
- **Docker Compose**: 여러 컨테이너를 한 묶음으로 정의하고 시작·중지하는 도구입니다. Sentry는 데이터베이스와 메시지 처리기 등 여러 서비스를 함께 사용하므로 필요합니다.
- **Bash**: Sentry의 공식 설치 스크립트를 해석해 실행하는 셸 프로그램입니다.

## 공식 요구사항과 이 컴퓨터 비교

2026-08-30 확인 시 최신 안정 Self-hosted 릴리스는 `26.8.0`입니다. Phase 2에서 실제 설치하기 직전에 릴리스 페이지와 알려진 문제를 다시 확인한 뒤 이 태그를 고정할 예정입니다. `master` 또는 `nightly`는 계속 변하므로 PoC 재현성에 사용하지 않습니다.

Sentry 26.8.0 설치 스크립트의 실제 검사값은 다음과 같습니다.

| 구분 | Feature-complete | Errors-only | 현재 호스트 |
| --- | ---: | ---: | ---: |
| Docker에 할당된 CPU | 4코어 이상 | 2코어 이상 | 물리 12코어, Docker 설치 후 할당량 확인 필요 |
| Docker에 할당된 RAM | 14,000MB 이상 | 7,000MB 이상 | 물리 32GB, Docker 설치 후 할당량 확인 필요 |
| Docker Engine | 19.03.6 이상 | 동일 | 미설치 |
| Docker Compose | 2.32.2 이상 | 동일 | 미설치 |
| Bash | 4.4 이상 | 동일 | 3.2.57, 미달 |

공식 일반 권장치는 4 CPU, 16GB RAM, 20GB 빈 디스크입니다. 문서의 오래된 일반 최소치(2 CPU/4GB)보다 현재 릴리스 설치 스크립트의 프로필별 강제 검사값이 더 구체적이므로, 실제 설치 판단에는 후자를 우선합니다.

이번 목표에는 Transaction/Span, 성능 지표, Web Vitals 검증이 포함되므로 기능이 제한되는 실험적 `errors-only` 프로필보다 `feature-complete` 프로필이 적합합니다.

## 실행 가능성 판단

**조건부 가능**입니다.

- 물리 CPU·메모리·디스크는 충분합니다.
- Docker Desktop 설치 후 Docker 가상 머신에 최소 4 CPU와 14GB RAM이 실제로 보여야 설치 검사를 통과합니다. PoC 안정성을 위해 6 CPU와 16GB RAM부터 시작하는 방안을 권장합니다.
- 호스트도 메모리를 사용하므로 Sentry 실행 중 브라우저, IDE, 다른 개발 서버를 많이 띄우면 메모리 압박이 생길 수 있습니다.
- 공식 26.8.0 Compose 파일은 Apple Silicon에서 `linux/arm64` 빌드를 지정할 수 있게 되어 있고, 릴리스에는 Linux ARM64 통합 테스트 수정도 포함되어 있습니다. 그래도 macOS Docker Desktop 자체가 운영용 Linux 서버와 같다는 뜻은 아니므로 Phase 2에서 컨테이너별 상태를 확인해야 합니다.

## 부족한 항목과 예상 위험

### 설치 전 해결이 필요한 항목

1. **Docker Desktop 설치**  
   앱 설치와 수 GB 규모 다운로드가 발생하므로 Phase 2 전에 별도 승인을 받습니다.
2. **Bash 4.4 이상 준비**  
   Homebrew의 최신 Bash를 설치한 뒤 해당 실행 파일로 `install.sh`를 실행하는 방안을 우선 검토합니다. 시스템 `/bin/bash`는 변경하지 않습니다.
3. **Docker 자원 할당 확인**  
   Docker Desktop 설정과 컨테이너 내부에서 보이는 CPU·RAM은 물리 사양과 다를 수 있습니다.
4. **ARM64 이미지 호환성 확인**  
   `DOCKER_PLATFORM=linux/arm64`를 사용할 예정이며, 이미지별 플랫폼과 health check를 설치 전에 기록합니다.

### 운영 중 예상 위험

- Feature-complete Sentry는 수십 개의 컨테이너를 실행하므로 메모리와 CPU 사용량이 큽니다.
- 공식 20GB는 권장 빈 공간의 하한입니다. 이미지, 빌드 캐시, 데이터 볼륨, 오프라인 반입용 이미지 아카이브까지 함께 보관하면 훨씬 더 필요합니다.
- 기본 이벤트 보관 기간이 길면 ClickHouse, PostgreSQL, Kafka 및 객체 저장소 볼륨이 계속 증가합니다.
- 노트북 절전이나 Docker Desktop 종료는 회사 서버 장애와 다른 형태로 컨테이너를 멈출 수 있습니다.
- 폐쇄망 테스트 전에 모든 이미지와 JS 패키지, Source map 업로드 도구를 온라인 상태에서 받아 두지 않으면 오프라인 단계가 실패합니다.
- Docker Desktop의 회사 사용 라이선스와 보안 정책은 기술 가능 여부와 별도로 확인해야 합니다.

## 프론트엔드 테스트 앱 선택 제안

**React + TypeScript + Vite + pnpm**을 권장합니다.

- 버튼 중심의 단일 페이지 PoC를 가장 작게 만들기 쉽습니다.
- React용 Sentry SDK의 오류 경계(Error Boundary)와 브라우저 자동 수집을 함께 비교할 수 있습니다.
- 현재 Node.js와 pnpm이 이미 설치되어 추가 런타임 준비가 없습니다.
- React 고유 기능에만 의존하지 않고, 대부분의 테스트 코드는 브라우저 JavaScript SDK 개념으로 작성해 Vue에도 대응되는 형태로 문서화합니다.

Vue를 선호한다면 Phase 3 전에 Vue 3 + TypeScript + Vite로 변경할 수 있으며 Phase 0의 다른 판단에는 영향이 없습니다.

## Phase별 파일과 예상 디스크 사용량

아래 수치는 아직 다운로드하지 않은 상태에서 잡은 **계획용 범위**입니다. Sentry 이미지 크기는 릴리스와 CPU 아키텍처에 따라 달라지므로 Phase 2에서 `docker system df`와 이미지 목록으로 실제 값을 기록합니다.

| Phase | 주 산출물 | 추가 디스크 예상 |
| --- | --- | ---: |
| 0 | `README.md`, `docs/00-environment.md`, `.gitignore` | 1MB 미만 |
| 1 | `docs/01-concepts.md`, `docs/02-local-architecture.md` | 1MB 미만 |
| 2 | `vendor/self-hosted` 또는 별도 고정 소스, 설치 문서, Docker 이미지·볼륨 | 20~40GB 우선 예산 |
| 3 | `test-app/`, `node_modules`, 빌드 결과 | 0.3~1GB |
| 4 | SDK/Source map 문서와 검증 기록 | 10~100MB + 이벤트 데이터 |
| 5 | 커스텀 데이터 코드와 문서 | 10MB 미만 + 이벤트 데이터 |
| 6 | 대시보드 문서와 화면 증적 | 10~100MB |
| 7 | 필터링 코드와 가짜 데이터 검증 증적 | 10~100MB + 이벤트 데이터 |
| 8 | 오프라인 테스트 기록, 필요 시 이미지 아카이브 | 아카이브 미보관 시 100MB 미만, 보관 시 20~40GB 추가 가능 |
| 9 | 회사 적용 문서 | 10MB 미만 |

전체 PoC에는 최소 40GB, 오프라인 반입용 이미지 아카이브까지 같은 디스크에 둘 경우 80GB 이상의 여유 공간을 잡는 편이 안전합니다. 현재 여유 약 549GiB이므로 공간은 충분하지만, 실제 사용량은 각 Phase에서 다시 측정합니다.

## 이후 실행 계획

### Phase 1 — 개념 및 아키텍처

- Sentry, SDK, DSN, 서버, 대시보드의 관계를 초보자용 문서와 흐름도로 설명합니다.
- SaaS/Self-hosted, 로컬 PoC/회사 폐쇄망의 차이를 분리합니다.
- 아직 Docker 설치나 네트워크 변경은 하지 않습니다.

### Phase 2 — 설치

- 시작 전에 실행 명령, 영향, 다운로드 크기 추정, 복구 방법을 먼저 제시하고 승인을 받습니다.
- Docker Desktop과 Bash 요구사항을 해결합니다.
- 공식 `getsentry/self-hosted` 안정 태그를 고정하고 이미지 목록을 기록합니다.
- 기존 Docker 자원과 구분되는 Compose 프로젝트 이름을 사용합니다.
- 설치 후 컨테이너 상태, `/_health/`, 웹 로그인, 시작·중지·재시작을 검증합니다.

### Phase 3~9

- React 또는 Vue 테스트 앱을 만든 뒤 기본 이벤트, 커스텀 데이터, 대시보드, 개인정보 필터링 순서로 검증합니다.
- 마지막에 네트워크 차단 상태의 내부 성공/외부 실패를 증거와 함께 기록합니다.
- PoC 결과를 회사 적용 시 프론트엔드·인프라·보안 담당 업무로 분리해 정리합니다.

## Phase 0에서 실행한 검증

성공:

- 운영체제, CPU, 메모리, 디스크 확인
- Git, Node.js, npm, pnpm, Bash, zsh, Homebrew 버전 확인
- Docker CLI와 Docker Desktop 앱 부재 확인
- 현재 디렉터리와 Git 상태 및 원격 저장소 확인
- 9000번 포트가 현재 사용되지 않음을 확인
- 공식 최신 릴리스, 설치 요구 버전, 프로필별 CPU/RAM 검사값 확인

확인 필요:

- Docker Desktop 설치 후 엔진과 Compose 실제 버전
- Docker에 할당된 CPU와 RAM
- 26.8.0의 모든 이미지가 이 Mac에서 ARM64로 실행되는지 여부
- 초기 이미지의 실제 다운로드 및 저장 크기
- React 권장안에 대한 사용자 선택

## 공식 근거

- [Sentry Self-Hosted 공식 문서](https://develop.sentry.dev/self-hosted/)
- [공식 getsentry/self-hosted 저장소](https://github.com/getsentry/self-hosted)
- [Self-hosted 26.8.0 릴리스](https://github.com/getsentry/self-hosted/releases/tag/26.8.0)
- [26.8.0 최소 요구사항 스크립트](https://github.com/getsentry/self-hosted/blob/26.8.0/install/_min-requirements.sh)
- [26.8.0 Docker Compose 정의](https://github.com/getsentry/self-hosted/blob/26.8.0/docker-compose.yml)

