# Sentry 대시보드 UI 커스텀

Self-hosted Sentry 26.8.0의 대시보드 위젯에 PoC용 탐색 동작과 플로우 시각화를 추가한다.

- 막대 선택 시 같은 기간·프로젝트·환경·대시보드 필터를 유지한다.
- 선택한 분류값을 검색 조건에 추가한다.
- Discover의 개별 오류 이벤트 표로 이동한다.
- 결과 표의 이벤트 ID 또는 오류 제목을 선택하면 Breadcrumbs가 있는 Event Details로 이동한다.
- 오류 이벤트 위젯에만 적용하며 Logs·Spans 차트 동작은 바꾸지 않는다.
- `snapshot.type:domain_flow_funnel` span table 위젯은 일반 표 대신 퍼널 카드로 렌더링한다.
- 퍼널 카드는 `flow.step_index` 순서로 단계를 정렬하고 `flow.step_display`, `flow.page_path`, 도달, 진행, 확정 이탈, 판정 대기, 이탈률을 함께 보여준다.

## 빌드

프로젝트 루트에서 실행한다.

```bash
docker build \
  --file sentry-ui-customization/Dockerfile \
  --tag sentry-self-hosted-drilldown:26.8.0 \
  sentry-ui-customization
```

빌드는 독립 패치 테스트, 변경한 Sentry 파일의 ESLint 검사, 프로덕션 번들 생성을 차례로 수행한다. Sentry의 고정된 프론트엔드 소스 조각이 정확히 일치할 때만 진행되며, 버전 업그레이드로 소스가 바뀌면 패치가 즉시 실패하므로 변경 내용을 다시 검토해야 한다. 공식 런타임 이미지에는 Sentry Jest 환경 전체가 포함되지 않으므로 Sentry의 co-located 테스트 파일은 패치에 포함하되 이미지 빌드 안에서는 직접 실행하지 않는다.

로컬 Docker 환경에서 Sentry 프론트엔드 ESLint가 장시간 무출력으로 멈추면, 독립 패치 테스트와 실제 소스 dry-run을 먼저 통과시킨 뒤 다음 옵션으로 lint만 건너뛴다.

```bash
docker build \
  --build-arg SKIP_SENTRY_LINT=1 \
  --build-arg SENTRY_BUILD_NODE_OPTIONS=--max-old-space-size=4096 \
  --file sentry-ui-customization/Dockerfile \
  --tag sentry-self-hosted-drilldown:26.8.0 \
  sentry-ui-customization
```

## 적용

데이터 볼륨은 변경하지 않는다. 웹 컨테이너만 커스텀 이미지로 교체한다.

```bash
cd .runtime/self-hosted
docker compose \
  -f docker-compose.yml \
  -f ../../sentry-ui-customization/compose.drilldown.yml \
  up -d --no-deps --wait web
```

이후 `./scripts/sentry.sh start`, `restart`, `stop`, `status`, `logs`는 이 Compose 오버레이를 자동으로 포함한다. 따라서 일반 재시작 후에도 상세보기 기능이 유지된다. 이미지가 없는 환경에서 `start` 또는 `restart`를 실행하면 기본 이미지로 조용히 돌아가지 않고 위 빌드 명령을 안내한 뒤 중단한다.

## 화면 확인

1. `http://127.0.0.1:9000/organizations/sentry/dashboard/2/`를 강력 새로고침한다.
2. `서비스별 오류` 등 업무 오류 막대 하나를 선택한다.
3. Explore 상세 표로 이동하고 선택한 Tag 필터가 검색 조건에 추가됐는지 확인한다.
4. 표의 이벤트 ID 또는 오류 제목을 선택해 Event Details로 이동한다.
5. Event Details의 Breadcrumbs에서 오류 직전 클릭·화면 이동·요청 기록을 확인한다.
6. `http://127.0.0.1:9000/organizations/sentry/dashboard/9/`의 `플로우별 최신 정확 집계` 위젯에서 가입·송금·결제 퍼널 카드가 단계 순서대로 보이는지 확인한다.

상세 표는 최대 100개를 최신순으로 표시한다. 원래 대시보드의 기간, 프로젝트, 환경, 공통 필터는 그대로 유지한다.

## 롤백

기본 Compose 정의로 웹 컨테이너를 다시 만든다.

```bash
cd .runtime/self-hosted
docker compose -f docker-compose.yml up -d --no-deps --wait --force-recreate web
```

기존 `sentry-self-hosted-local` 이미지와 Sentry 데이터 볼륨은 그대로 보존된다.
