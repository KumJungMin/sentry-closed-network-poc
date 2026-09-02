# Phase 9: 회사 폐쇄망 도입 가이드

- 작성일: 2026-09-02 (Asia/Seoul)
- 검증 버전: Self-hosted Sentry `26.8.0`
- 적용 대상: 인터넷 egress가 차단된 사내망의 소규모 파일럿과 운영 전환 검토
- 결론: **핵심 오류 수집은 도입 가능하지만, 현재 상태 그대로 실제 개인정보가 포함될 수 있는 운영 트래픽을 받으면 안 된다.**

## 경영·기술 의사결정 요약

이 PoC는 서버의 외부 통신을 실제로 차단한 상태에서 오류 수집, 조회, Source map 업로드, 전체 컨테이너 재시작, 기존 데이터 재조회가 가능함을 확인했다. 따라서 설치 파일과 패키지를 사전에 반입하고 내부 DNS·HTTPS·인증서를 구성하면 핵심 오류 관찰 기능은 폐쇄망에서 사용할 수 있다.

다만 Sentry 공식 Self-hosted 배포판 자체가 저용량 배포와 PoC에 맞춘 패키지로 설명되어 있으며, SaaS 수준의 가용성·보안 패치·백업·확장 운영을 제공하는 관리형 제품은 아니다. 회사가 다음 책임을 직접 가져야 한다.

- 57개 컨테이너와 데이터 저장소 운영, 용량 계획, 모니터링
- 반입 이미지·패키지의 공급망 검증과 정기 업데이트
- 계정·권한·TLS·비밀정보·개인정보 정책 관리
- 데이터베이스별 일관된 백업과 실제 복구 훈련
- 장애, 보안 취약점, 버전 업그레이드 대응

현재 가장 중요한 차단 항목은 [Phase 7](07-security.md)의 Relay 서버 단독 개인정보 제거 probe 실패다. 클라이언트 SDK 필터는 검증됐지만, 이를 우회한 합성 원문 15개가 서버 저장소에 남았다. 이 원인을 해결하고 같은 probe가 통과하기 전까지는 승인된 합성 데이터만 사용하는 파일럿으로 범위를 제한한다.

## 권장 대상 구성

```text
개발자 브라우저 / 업무 애플리케이션 SDK / 폐쇄망 CI
                  │ HTTPS 443
                  ▼
        사내 DNS + 외부 Reverse Proxy/LB
        TLS 종료 · IP 제한 · 요청 크기/속도 제한
                  │ 내부 전용 포트
                  ▼
       Self-hosted Sentry 단일 Linux 서버
       Nginx/Relay/Web/Worker/Kafka/ClickHouse/
       PostgreSQL/Valkey/SeaweedFS 등 Docker Compose
           │                    │
           ▼                    ▼
    사내 SMTP relay(선택)   백업 저장소·호스트 모니터링
```

Reverse proxy 또는 Load Balancer는 Docker 호스트와 분리하는 편이 좋다. Sentry 호스트나 Docker Engine 전체가 내려가도 접근 차단, TLS 정책, 점검 화면을 유지할 수 있기 때문이다. 외부 공개는 기본 금지하고 업무망·CI·관리망에서 필요한 방향만 허용한다.

권장 내부 주소 예시는 `https://sentry.company.internal`이다. 주소가 바뀌면 SDK DSN, Sentry의 외부 URL, Source map 업로드 주소, 브라우저 CORS 정책을 함께 바꿔야 하므로 IP 주소를 직접 배포하지 않는다.

## 서버 사양과 용량 산정

### 공식 최소치와 PoC 실측

| 구분 | CPU | 메모리 | 저장공간 | 의미 |
| --- | ---: | ---: | ---: | --- |
| 26.8.0 전체 기능 설치 검사 | 4 core | Docker에 14,000MB, 호스트 약 16GB 이상 | 설치 전에 여유 공간 필요 | 설치 가능 여부를 보는 하한이며 운영 여유가 아님 |
| `errors-only` 프로필 설치 검사 | 2 core | Docker에 7,000MB | 기능 축소에 따라 별도 산정 | 오류만 수집하는 최소 프로필 |
| 이번 PoC Docker 할당 | 6 core | 약 15.6GiB | 호스트 여유 약 524GiB | 단일 사용자·합성 이벤트 검증 환경 |
| 이번 PoC 현재 사용량 | 순간 합계 약 13.16GiB | 이미지 10.95GB, 활성 볼륨 2.01GB | 낮은 이벤트량의 한 시점 | 부하 시험이나 장기 증가량은 아님 |
| 사내 소규모 파일럿 시작점 | **8 vCPU** | **32GB RAM** | **200GB 이상 SSD** | 운영체제·Docker·일시 피크·업데이트 여유를 포함한 제안값 |

파일럿 시작점은 보장 사양이 아니다. 프로젝트 수, 일일 오류·트랜잭션 수, 첨부파일·Replay 사용 여부, 보존 기간에 따라 크게 달라진다. 2~4주 동안 실제와 유사한 합성 부하를 넣고 CPU, 메모리, Kafka lag, ClickHouse 처리량, 볼륨 증가량을 측정한 뒤 운영 사양을 확정한다.

현재 57개 컨테이너 재시작 때 PoC의 6 core·15.6GiB 환경에서는 수 분 동안 HTTP 502가 발생했다. 따라서 공식 최소치에 딱 맞춘 운영 배치는 권장하지 않는다.

### 디스크 계산법

현재 `SENTRY_EVENT_RETENTION_DAYS=90`이고 활성 볼륨은 약 2.01GB지만, 이는 매우 적은 합성 이벤트만 저장한 값이다. Kafka의 3시간 log retention은 이벤트 보존 기간이 아니라 처리 대기 로그의 보존 설정이다.

운영 디스크는 다음처럼 실측한다.

```text
예상 데이터 = 실제 유사 부하에서 측정한 일일 볼륨 증가량 × 보존 일수
필요 SSD = 예상 데이터 + 이미지/로그/임시 작업 공간 + 30~50% 여유
백업 용량 = 보관 세대별 전체·증분 백업 + 복구 검증용 별도 공간
```

파일럿은 30일 보존부터 시작하고 법무·보안·장애 분석 요구가 90일을 필요로 하는지 승인받는 방식을 권장한다. 디스크 70% 알림, 80% 증설 또는 보존 축소, 90% 수집 보호 조치를 사내 기준으로 정한다. 첨부파일, 프로파일, Replay를 켜면 별도 증가량을 다시 측정한다.

## 폐쇄망 반입 묶음

반입 단위는 “Docker 이미지 몇 개”가 아니라 같은 버전으로 재설치할 수 있는 검증된 릴리스 묶음이어야 한다.

### Sentry 서버

- Self-hosted 소스 `26.8.0`, 커밋 `73fe2f2747800873f0896aec283c45b6dcf34432`
- Docker Engine, Compose 2.32.2 이상, Bash 4.4 이상과 사내 승인 설치 파일
- Compose가 참조하는 Sentry, Relay, Snuba, Symbolicator, Taskbroker, Vroom, Launchpad, Uptime Checker 이미지
- PostgreSQL, Kafka, Valkey, Memcached, nginx, PgBouncer, SeaweedFS, SMTP, ClickHouse 기반 이미지
- 로컬 빌드한 `sentry-self-hosted-local`, `sentry-cleanup-self-hosted-local`, `clickhouse-self-hosted-local` 이미지
- 설치 중 필요한 `sentry-nodestore-s3`, Alpine/Debian 패키지와 선택적 브라우저 SDK asset
- `.env.custom`, `config.yml`, `sentry.conf.py`, reverse proxy 설정 템플릿
- 내부 CA root/intermediate 인증서와 서버 인증서 발급 절차

`sentry-nodestore-s3`의 움직이는 `main.zip` 참조는 검증한 커밋 또는 사내 artifact로 고정하고 SHA-256을 기록한다. 모든 컨테이너 tag는 가능하면 digest까지 고정한다.

### 프론트엔드와 CI

- 승인된 Node.js와 pnpm 실행 파일
- `pnpm-lock.yaml`과 전체 pnpm store 또는 사내 npm registry
- `@sentry/react`, `@sentry/cli`와 대상 OS용 CLI 바이너리
- Source map Debug ID 주입·업로드 스크립트
- 내부 Sentry 주소와 CA 인증서를 사용하는 환경 설정 템플릿
- 최소 권한 Source map 업로드 토큰을 넣는 CI Secret 경로

### 반입 manifest 필드

| 필드 | 예시 |
| --- | --- |
| 제품/버전/커밋 | `self-hosted 26.8.0 / 73fe...` |
| 파일명 또는 image digest | `registry/path@sha256:...` |
| SHA-256 | 전송 전후 동일성 검사 |
| 출처와 다운로드 일시 | 공식 release URL과 UTC 시간 |
| SBOM·라이선스 | 이미지·npm·OS 패키지별 보관 |
| 악성코드·취약점 검사 결과 | 도구, DB 갱신일, 예외 승인자 |
| 반입 승인·만료일 | 보안 승인 번호와 재검토일 |

## 온라인 준비부터 폐쇄망 설치까지

1. 인터넷이 가능한 공급망 구역에서 목표 릴리스와 release note를 검토한다.
2. tag·commit·digest·lockfile을 고정하고 필요한 모든 이미지와 패키지를 내려받는다.
3. 이미지 취약점, SBOM, 라이선스, 악성코드와 SHA-256을 검사한다.
4. 승인된 이동 매체 또는 사내 artifact transfer 경로로 반입한다.
5. 폐쇄망 경계에서 해시와 승인 manifest를 다시 확인한다.
6. 내부 registry와 npm repository가 있으면 그곳에 등록한다. 없으면 `docker save/load` 또는 OCI archive와 pnpm store를 사용한다.
7. 인터넷 주소를 참조하는 설치 단계를 내부 mirror 또는 사전 빌드 이미지로 치환한다.
8. staging에서 `pull_policy: never`, `pnpm install --offline --frozen-lockfile`로 완전 오프라인 설치를 재현한다.
9. health, 로그인, 신규 이벤트 최종 저장, Source map 복원, 재시작, 백업 복구를 검증한 뒤 운영 승인을 받는다.

이 PoC에서 “이미 설치된 버전 재기동”은 외부 registry 없이 성공했지만, `install.sh`는 GitHub와 OS package repository 등에 접근할 수 있다. 온라인 설치를 한 번 성공했다는 사실만으로 폐쇄망 재설치 가능하다고 판정하지 않는다.

## 내부 DNS, HTTPS와 방화벽

### 필수 기준

- 사내 DNS에 고정 FQDN을 만들고 Sentry 외부 URL과 DSN을 동일한 HTTPS 주소로 발급한다.
- 사내 CA 인증서를 브라우저, 애플리케이션 런타임, CI, `sentry-cli`, reverse proxy가 모두 신뢰하게 한다.
- TLS 1.2 이상과 사내 cipher·인증서 갱신 기준을 적용한다.
- 사용자/SDK/CI → reverse proxy 443만 허용하고 DB, Kafka, Redis, ClickHouse 포트는 Docker 내부에만 둔다.
- 관리자 접근은 별도 관리망 또는 VPN과 허용 목록으로 제한한다.
- Sentry 서버 egress는 기본 차단하고 내부 DNS, NTP, SMTP, registry, 인증, 백업처럼 승인된 목적지만 예외로 둔다.
- `/_health/`와 실제 합성 이벤트의 최종 저장을 함께 감시한다.
- ingest endpoint에 요청 크기, 연결 수, IP/서비스별 rate limit을 둔다.

브라우저 SDK를 쓰면 애플리케이션 origin에서 ingest 주소로 보내는 요청을 허용해야 한다. 허용 origin을 `*`로 넓히지 말고 등록된 사내 서비스만 사용한다. 인증서 갱신은 SDK 통신과 Source map CI 업로드를 모두 시험해야 완료로 본다.

## 데이터 보존과 삭제

보존 기간은 기술 담당자가 임의로 정하지 않고 서비스 오너, 보안, 개인정보, 법무가 승인한다.

| 데이터 | 기본 방침 |
| --- | --- |
| 오류·트랜잭션 | 파일럿 30일 제안, 승인 후 변경 |
| Source map·debug file | 해당 release 분석 기간과 삭제 절차를 별도 정의 |
| 첨부파일 | 기본 비활성화, 필요 시 크기·형식·보존 승인 |
| Session Replay | 현재 0%, 별도 보안 심사 전 활성화 금지 |
| Audit/운영 로그 | 사내 감사 정책에 따라 중앙 로그로 전달 |
| 백업 | 운영 데이터보다 길게 남을 수 있으므로 별도 만료·폐기 정책 적용 |

Sentry cleanup이 외부 object storage의 파일까지 모두 삭제한다고 가정하지 않는다. 외부 storage를 사용할 경우 lifecycle 정책과 삭제 검증을 별도로 구성한다.

## 백업과 복구

### 두 종류를 구분한다

Sentry의 `./scripts/backup.sh` 또는 관리 CLI JSON backup은 사용자, 조직, 프로젝트, 팀, alert 같은 저용량 설정을 옮기는 **부분 백업**이다. 과거 event, issue, 외부 파일은 포함하지 않으므로 재해 복구 백업으로 충분하지 않다.

전체 데이터 복구는 저장소별 일관된 backup/snapshot을 회사가 설계해야 한다. 공식 문서는 전체 Docker volume backup을 지원된 절차로 보장하지 않으므로, 단순 volume 복사만 믿지 말고 동일 버전 staging에서 정기적으로 복구 시험한다.

| 대상 | 목적 | 최소 운영 원칙 |
| --- | --- | --- |
| PostgreSQL | 계정·조직·프로젝트·Issue 메타데이터 | DB 일관성이 보장되는 backup, 암호화, restore 검사 |
| ClickHouse | event·transaction 조회 데이터 | ClickHouse 방식에 맞는 backup/snapshot과 query 검증 |
| SeaweedFS/filestore | Source map·첨부·프로파일 등 | DB와 연계된 시점, 객체 개수·해시 검사 |
| Kafka | 처리 중 데이터 | 장기 원장이 아님. 장애 시 유실 가능한 ingest 경계를 문서화 |
| Redis·Taskbroker | cache와 작업 상태 | 재생성 가능 범위와 처리 중 작업 유실 범위를 시험 |
| Sentry/Symbolicator volume | 파일과 symbol cache | 필요한 영속 데이터와 재생성 가능한 cache 구분 |
| 구성·secret | `.env.custom`, 설정, Relay credential, secret key | Git과 분리, secret manager/암호화 backup, 접근 감사 |

### 복구 Runbook

1. 사고 시각, 마지막 정상 backup, 목표 RPO/RTO와 유실 범위를 선언한다.
2. 네트워크 ingest를 중지하고 손상된 원본을 보존한다.
3. 백업과 정확히 같은 Sentry 버전의 깨끗한 환경을 준비하고 migration을 완료한다.
4. secret·구성, PostgreSQL, ClickHouse, filestore 등 사전에 검증한 순서로 복원한다.
5. 컨테이너 health만 보지 말고 로그인, 프로젝트/권한, 과거 event query, 신규 event 최종 저장, Source map을 검사한다.
6. 보안 승인 후 ingest와 사용자 접근을 단계적으로 연다.
7. 실제 RPO/RTO, 누락 데이터와 개선 항목을 기록한다.

백업은 운영 호스트와 다른 장애 영역에 암호화해 보관하고, 키는 백업과 분리한다. 최소 분기 1회 복구 훈련을 권장한다. 초기 목표 예시는 RPO 24시간/RTO 4시간이지만 서비스 중요도에 따라 공식 승인을 받아야 한다.

## 버전 업데이트 절차

Self-hosted Sentry는 월 단위 CalVer를 사용하며 이전 버전에 항상 보안 patch가 backport되는 장기 지원 배포판이 아니다. 폐쇄망에서는 외부 보안 공지와 release 정보를 내부로 전달하는 담당자가 반드시 필요하다.

1. 공식 release, changelog, GitHub Security Advisory와 알려진 문제를 외부 구역에서 확인한다.
2. 현재 버전부터 목표 버전까지 필요한 hard stop을 공식 upgrade 문서에서 확인한다.
3. 목표 소스·이미지·패키지를 고정하고 스캔·승인·반입한다.
4. 운영과 같은 데이터의 비식별 staging 복제본으로 각 hard stop을 순서대로 upgrade한다.
5. 설정 예제 차이와 `.env.custom`을 검토하고 Phase 4~8 검증을 재실행한다.
6. 변경 시간, 예상 중단, rollback 기준을 공지하고 일관된 backup/snapshot을 확보한다.
7. 서비스를 중단한 뒤 공식 `install.sh` migration과 Compose 기동을 수행한다.
8. health, 로그인, 권한, ingest 최종 저장, queue lag, query, Source map, 알림을 확인한다.
9. 관찰 기간 뒤 변경을 종료하고 manifest·버전·결과를 CMDB에 남긴다.

DB migration 뒤에 컨테이너 이미지만 이전 버전으로 되돌리는 것을 rollback으로 간주하지 않는다. 하위 호환성이 보장되지 않으면 동일 시점 backup을 복구해야 한다. `--minimize-downtime`은 공식 문서에서도 실험적 흐름이므로 회사 검증 없이 사용하지 않는다.

## 취약점 대응

- 보안 담당은 인터넷 구역에서 Sentry release, Sentry GitHub Security Advisory, 기반 이미지와 npm/OS 패키지 공지를 구독한다.
- 발견 항목을 내부 티켓으로 이관해 영향 버전, 노출 경로, CVSS, exploit 여부, 보완 통제를 평가한다.
- 반입 registry에서 정기 재스캔한다. 스캔 DB가 폐쇄망에서도 갱신되는 절차가 필요하다.
- 긴급 patch가 없으면 egress/inbound 차단 강화, 기능 비활성화, 계정 제한 같은 임시 통제를 기록한다.
- 수정본은 일반 update와 같은 staging·backup·복구 기준을 통과시킨다.
- 예시 SLA는 Critical 24시간 내 평가·72시간 내 완화 계획, High 3영업일 내 평가다. 실제 기한은 회사 보안 정책으로 승인한다.
- 발견한 Sentry 자체 취약점은 공개 Issue에 secret이나 exploit을 올리지 말고 공식 security reporting 절차를 따른다.

## 개인정보·금융정보 보안 기준

### 운영 전 필수 조건

1. Phase 7 `--server-probe`에서 15개 합성 원문이 남는 Relay 경로 문제를 원인 규명하고 0개 저장을 증명한다.
2. 클라이언트 `beforeSend`와 breadcrumb filter를 공통 패키지·코드리뷰 규칙으로 강제한다.
3. 이름, 연락처, 이메일, 계좌·거래 식별값, 인증정보, header/body/query, 자유 입력 원문을 수집 금지한다.
4. Tag allowlist를 사용하고 개인정보가 검색 index에 들어가지 않게 한다.
5. Replay, 첨부파일, user feedback은 별도 위협 모델과 실제 저장 검증 전까지 끈다.
6. 신규 SDK·프로젝트·Sentry upgrade마다 합성 데이터로 저장본을 재검사한다.

DSN은 이벤트 제출 주소이므로 브라우저에서 보일 수 있지만, 관리자 API token이나 Source map 업로드 token과 같은 비밀 권한을 주지 않는다. 관리 token은 개인 PC 파일에 평문 저장하지 않고 secret manager와 CI의 masked secret을 사용하며 최소 scope·만료·회전·감사를 적용한다.

## 사용자와 권한

| 역할 | 회사 사용 원칙 |
| --- | --- |
| Owner | 플랫폼 책임자 2명 등 최소 인원, 비상 계정 별도 보관 |
| Manager | 프로젝트·팀·구성 운영 담당자에 제한 |
| Member | 개발자 기본 역할, 필요한 팀·프로젝트만 참여 |
| Team Admin | 해당 팀 관리가 필요한 경우에만 부여 |
| CI token | 사용자와 분리, Source map upload 등 목적별 최소 scope |
| 읽기 API token | 자동 검증·대시보드 조회에 필요한 읽기 scope만 부여 |

초기 설치 master 계정을 일상 공유 계정으로 사용하지 않는다. 개인별 계정, 퇴사·이동 시 즉시 회수, 분기별 권한 재인증, 로그인/audit log 점검을 적용한다. 폐쇄망에서 회사 IdP 연동이 지원되는지는 목표 버전과 IdP 조합으로 별도 검증하고, 연동하지 못하면 강한 비밀번호·회전·비상 복구 절차를 둔다.

## 역할과 책임

| 업무 | 서비스/프론트엔드 | 인프라/SRE | 보안·개인정보 | 플랫폼 오너 |
| --- | --- | --- | --- | --- |
| SDK 적용·업데이트 | 구현·테스트 | CI 지원 | 수집 항목 검토 | 표준 제공 |
| Event/Tag 설계 | allowlist 제안 | 용량 영향 공유 | 개인정보 승인 | 최종 표준 승인 |
| Source map | Debug ID 빌드·업로드 | CI secret 경로 | token scope 감사 | 실패 운영 지원 |
| 서버·Docker | 상태 확인 협조 | 설치·모니터링·장애 대응 | hardening 점검 | 버전 기준 결정 |
| DNS·TLS·방화벽 | endpoint 적용 | 구성·갱신 | 정책 승인·감사 | 변경 조정 |
| 보존·삭제 | 분석 필요 기간 제안 | cleanup·용량 운영 | 법적 기간 승인 | 충돌 조정 |
| 백업·복구 | 사용자 기능 검증 | backup·restore 실행 | 암호화·접근 감사 | RPO/RTO 승인 |
| 취약점·업데이트 | 회귀 검증 | 반입·upgrade·rollback | 위험 평가·긴급 통제 | Go/No-go |
| 개인정보 probe | 클라이언트 fixture 유지 | Relay 경로 조사 | 통과 기준 승인 | 운영 차단 해제 |

각 업무에는 실명 Primary와 Backup을 지정한다. Self-hosted를 선택하면 이 표의 빈칸을 Sentry SaaS가 대신 수행해 주지 않는다.

## PoC와 운영 환경의 차이

| 항목 | 현재 PoC | 운영 전 필요한 상태 |
| --- | --- | --- |
| 호스트 | macOS Docker Desktop 한 대 | 지원 Linux 서버, 사내 표준 Docker/보안 설정 |
| 부하 | 단일 사용자·합성 이벤트 | 예상 peak의 부하·장기 soak 시험 |
| 가용성 | 단일 호스트, 재시작 중 502 | 승인된 점검 시간·복구 절차·외부 LB |
| 저장소 | 로컬 Docker volume | 용량 추세, backup, 복구 훈련, 장애 영역 분리 |
| 주소 | `127.0.0.1:9000` | 내부 DNS·HTTPS·사내 CA |
| 네트워크 | Docker egress 차단 | VLAN·방화벽·관리망·CI까지 실제 정책 검증 |
| 계정 | 로컬 master/PoC token | 개인 계정, 최소 권한, 수명 주기와 감사 |
| 데이터 | `FAKE-*` 합성값 | 승인된 allowlist와 서버 probe 통과 후에만 업무 데이터 |
| 알림/연동 | 외부 SMTP·Slack·GitHub 제외 | 내부 SMTP와 승인된 대체 연동 시험 |
| 업데이트 | 한 버전 설치 | release 감시, 반입 pipeline, staging, rollback |
| 운영 관찰 | 수동 Docker/API 확인 | 24×7 또는 승인 시간대의 중앙 모니터링·on-call |

## 단일 서버의 한계

- 호스트, Docker Engine, 로컬 disk가 모두 단일 장애점이다.
- upgrade와 일부 migration 동안 서비스가 중단된다.
- Kafka, ClickHouse, PostgreSQL, Relay, Web이 CPU·메모리·I/O를 경쟁한다.
- disk 고갈이나 queue 적체가 여러 기능에 동시에 영향을 준다.
- 동일 호스트 volume만으로는 호스트 손상·랜섬웨어·운영 실수를 복구할 수 없다.
- Compose 단일 노드 배포는 자동 failover, 무중단 upgrade, 지역 재해 복구를 제공하지 않는다.

낮은 중요도의 내부 오류 관찰과 허용된 점검 시간이 있는 환경에는 단일 서버가 현실적인 시작점이다. 반대로 24×7 수집 무중단, 엄격한 RPO/RTO, 대규모 ingest가 필요하면 PoC 성공만으로 이 구성을 승인하지 않는다.

## 고가용성·대규모 도입 시 추가 검토

1. 업무별 peak event·transaction·attachment·profile 양과 query 동시성을 부하 시험한다.
2. 외부 LB와 ingest rate limit, health 기반 트래픽 제어를 구성한다.
3. web/ingest/consumer, Kafka, ClickHouse, PostgreSQL, object storage를 어떤 장애 영역으로 분리할지 설계한다.
4. 각 외부화 저장소가 목표 Sentry 버전에서 지원·검증되는지 확인한다. 공식 문서에서 실험적이라고 표시한 S3 backend를 검증 없이 HA 해법으로 채택하지 않는다.
5. queue ordering, migration, schema, backup 일관성과 네트워크 지연을 포함한 장애 주입 시험을 한다.
6. Compose 배포판을 임의로 Kubernetes HA 제품으로 바꾸는 데 필요한 전담 운영 역량과 upgrade 책임을 산정한다.
7. 요구 SLA가 높으면 Sentry SaaS 사용 가능성, 사내 승인된 상용/관리형 대안, 로그 플랫폼과의 역할 분리를 함께 비교한다.

## 운영 모니터링과 일상 Runbook

최소 감시 항목은 다음과 같다.

- 호스트 CPU, memory, load, disk 사용률·inode·I/O latency
- 컨테이너 restart, unhealthy, OOM, 예상 replica 수
- `/_health/` HTTP 상태와 응답 시간
- Relay ingest 오류율과 nginx 4xx/5xx
- Kafka broker 상태·consumer lag, taskbroker/taskworker 적체
- ClickHouse query/insert 오류, PostgreSQL connection·backup 상태
- 마지막 정상 합성 event가 UI/API에 최종 저장된 시간
- TLS 인증서 만료, backup 성공과 마지막 restore drill

SDK/Relay가 HTTP 200을 반환해도 후단 Kafka·consumer 장애로 최종 event가 보이지 않았던 사례가 Phase 4에서 있었다. 따라서 단순 HTTP health와 함께 주기적인 무민감 합성 event를 보내 고유 ID가 검색되는지 end-to-end로 확인한다.

장애 시에는 `docker compose ps`, unhealthy/restart/OOM, host disk, nginx/Relay, Kafka·consumer, ClickHouse/PostgreSQL 순으로 범위를 좁힌다. 재기동 전에 로그와 상태를 보존하고, 데이터 삭제 가능성이 있는 `down -v`는 운영 복구 명령으로 사용하지 않는다.

## 단계별 도입 Gate

### Gate 0: 합성 데이터 파일럿

- 내부 Linux staging, DNS, HTTPS, 방화벽 구성
- 반입 manifest와 완전 오프라인 재설치 성공
- 합성 부하, restart, update, backup/restore 훈련
- 실제 개인정보와 운영 token 반입 금지

### Gate 1: 제한된 사내 파일럿

- Phase 7 서버 probe 0건 저장 및 보안 승인
- 30일 보존, 용량 추세와 alert 검증
- 개인 계정·최소 권한·CI secret·감사 적용
- 비민감 내부 서비스 1~2개만 allowlist로 연결
- 승인 RPO/RTO와 담당자/on-call 지정

### Gate 2: 운영 확대

- 예상 peak/soak 시험과 서버 사양 확정
- upgrade·취약점 반입 SLA 실적 확보
- 분기 restore drill과 장애 훈련 통과
- 보존·삭제·백업·개인정보 처리 문서 승인
- 단일 노드 SLA 수용 또는 별도 HA 설계 승인

## 최종 승인 체크리스트

- [ ] 실제 운영용 Linux 사양과 30~50% 여유가 승인됐다.
- [ ] 모든 image/package/source가 digest·SHA-256·SBOM과 함께 반입된다.
- [ ] 폐쇄망에서 신규 설치와 update를 인터넷 없이 재현했다.
- [ ] 내부 DNS, HTTPS, 사내 CA, 인증서 자동 갱신을 검증했다.
- [ ] DB/Kafka/ClickHouse 포트가 사용자망에 노출되지 않는다.
- [ ] 보존 기간, 첨부·Replay 정책과 삭제 책임자가 승인됐다.
- [ ] 부분 설정 backup과 전체 DR backup의 차이를 이해하고 restore drill을 통과했다.
- [ ] hard stop을 포함한 update와 migration rollback 절차를 시험했다.
- [ ] 취약점 공지를 외부에서 내부로 전달하는 담당자와 SLA가 있다.
- [ ] 개인 계정·최소 권한·퇴사자 회수·비상 계정 절차가 있다.
- [ ] Phase 7 Relay 서버 probe에서 합성 민감 원문 저장이 0건이다.
- [ ] frontend, infra, security, platform owner의 Primary/Backup이 지정됐다.
- [ ] 단일 서버의 중단과 데이터 유실 위험을 서비스 오너가 수용했다.
- [ ] 합성 event의 end-to-end 저장과 backup 복구를 중앙 모니터링한다.

하나라도 보안·복구·책임 항목이 미완료면 합성 데이터 파일럿 범위를 유지한다.

## 아직 회사가 결정해야 할 값

| 결정 | 제안 시작값 | 승인 주체 |
| --- | --- | --- |
| 운영 범위 | 비민감 내부 서비스 1~2개 | 서비스 오너·보안 |
| 보존 기간 | 30일 | 보안·개인정보·법무 |
| RPO / RTO | 24시간 / 4시간 | 서비스 오너·인프라 |
| 가용 시간 | 점검 시간 허용 단일 노드 | 서비스 오너 |
| 서버 | 8 vCPU / 32GB / 200GB SSD부터 측정 | 인프라 |
| patch SLA | Critical 24시간 평가, 72시간 완화 계획 | 보안·플랫폼 오너 |
| 인증 | 사내 IdP 검증 또는 개인 로컬 계정 | IAM·보안 |
| 외부 연동 | 내부 SMTP만 우선, 나머지 비활성 | 보안·서비스 오너 |

## 최종 판정

이 PoC의 기술 목표인 “외부 인터넷 없이 내부 오류를 수집하고 조회할 수 있는가”는 통과했다. 회사 도입은 **저용량·점검 시간 허용·전담 운영 책임·검증된 반입 체계**라는 조건에서 가능하다.

그러나 현재 Phase 7 Relay 서버 단독 개인정보 제거 실패 때문에 실제 고객·금융 데이터를 다룰 수 있는 운영 승인 상태는 아니다. 먼저 서버 수집 경로의 제거 정책을 고치고 저장본 0건을 증명한 뒤 Gate 1로 진행한다. 높은 가용성이나 대규모 처리가 필요하면 단일 Compose 서버를 그대로 확대하지 말고 별도 아키텍처와 대안을 비교한다.

## 공식 참고 자료

- [Sentry Self-hosted 공식 저장소](https://github.com/getsentry/self-hosted)
- [Self-hosted backup과 restore](https://develop.sentry.dev/self-hosted/backup/)
- [Self-hosted release와 upgrade](https://develop.sentry.dev/self-hosted/releases/)
- [Simple single node reference architecture](https://develop.sentry.dev/self-hosted/reference-architecture/simple-single-box/)
- [Reverse proxy 운영 보강](https://develop.sentry.dev/self-hosted/production-enhancements/reverse-proxy/)
- [External storage 운영 보강](https://develop.sentry.dev/self-hosted/production-enhancements/external-storage/)
- [Sentry Security Policy](https://github.com/getsentry/sentry/security/policy)
- [Organization membership와 역할](https://docs.sentry.io/organization/membership/)
- [Organization member 역할 변경 API](https://docs.sentry.io/api/organizations/update-an-organization-members-roles/)
