import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboards = JSON.parse(await readFile(new URL("./phase6-dashboards.json", import.meta.url), "utf8"));
const errorPeriodDashboardTitles = new Set([
  "PoC - 일간 오류 (24시간)",
  "PoC - 주간 오류 (7일)",
  "PoC - 월간 오류 (30일)",
]);

test("일간·주간·월간 오류 대시보드의 저장 기간을 고정한다", () => {
  const periods = Object.fromEntries(
    dashboards
      .filter(({ title }) => errorPeriodDashboardTitles.has(title))
      .map(({ title, period }) => [title, period]),
  );
  assert.deepEqual(periods, {
    "PoC - 일간 오류 (24시간)": "24h",
    "PoC - 주간 오류 (7일)": "7d",
    "PoC - 월간 오류 (30일)": "30d",
  });
});

test("각 기간 대시보드는 오류·사용자·추이·순위를 모두 제공한다", () => {
  for (const dashboard of dashboards.filter(({ title }) => errorPeriodDashboardTitles.has(title))) {
    assert.equal(dashboard.widgets.length, 4);
    assert.ok(dashboard.widgets.some(({ title }) => title.startsWith("영향받은 사용자")));
    assert.ok(dashboard.widgets.some(({ title }) => title.startsWith("주요 오류")));
  }
});

test("성능 대시보드는 전체 및 페이지별 Performance Score와 Web Vitals를 함께 제공한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - API 및 프론트엔드 성능");
  const scoreFormula = "performance_score(measurements.score.total)";
  assert.ok(dashboard.widgets.some(({ title }) => title === "종합 성능 점수"));

  const pageWidget = dashboard.widgets.find(({ title }) => title === "페이지별 Web Vitals");
  assert.ok(pageWidget.queries[0].fields.includes(scoreFormula));
  assert.ok(pageWidget.queries[0].fields.includes("p75(browser.web_vital.fcp.value)"));
  assert.ok(pageWidget.queries[0].fields.includes("p75(browser.web_vital.lcp.value)"));
});

test("업무 Tag의 내부 검색 키는 유지하고 표시 제목과 열 별칭만 한국어화한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 업무 오류 분석");
  const channelWidget = dashboard.widgets.find(({ title }) => title === "채널별 오류");

  assert.equal(channelWidget.queries[0].conditions, "has:channel");
  assert.deepEqual(channelWidget.queries[0].fields, ["channel", "count()"]);
  assert.deepEqual(channelWidget.queries[0].fieldAliases, ["채널", "오류"]);
});

test("가입 퍼널은 pageView 기반 확정 이탈·대기·이탈률의 최신 정확 집계를 표시한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 가입 퍼널 및 사용자 지표");
  const aggregates = dashboard.widgets.flatMap(({ queries }) => queries.flatMap(({ aggregates: values }) => values));

  assert.ok(aggregates.includes("max(value,poc.signup.reached,gauge,none)"));
  assert.ok(aggregates.includes("max(value,poc.signup.drop_off,gauge,none)"));
  const exactWidget = dashboard.widgets.find(({ title }) => title === "가입 퍼널 최신 정확 집계");
  assert.equal(exactWidget.widgetType, "spans");
  assert.ok(exactWidget.queries[0].fields.includes("funnel.step_label"));
  assert.ok(exactWidget.queries[0].fields.includes("tags[funnel.pending_drop_off,number]"));
  assert.ok(exactWidget.queries[0].fields.includes("tags[funnel.drop_off_rate,number]"));
});

test("활성 사용자 모수 기반 오류 영향률을 Sentry Dashboard에서 순위화한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 가입 퍼널 및 사용자 지표");
  const rateWidget = dashboard.widgets.find(({ title }) => title === "활성 사용자 대비 오류 최신 정확 집계");

  assert.equal(rateWidget.widgetType, "spans");
  assert.ok(rateWidget.queries[0].fields.includes("tags[usage.active_users,number]"));
  assert.ok(rateWidget.queries[0].fields.includes("tags[usage.affected_user_rate,number]"));
});

test("로그·Replay·사용자 ID·개인정보 JIT 상태를 한 대시보드에 제공한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 실시간 로그·Replay·개인정보");

  assert.ok(dashboard.widgets.some(({ widgetType }) => widgetType === "logs"));
  assert.equal(
    dashboard.widgets.find(({ title }) => title === "Replay 연결 오류").queries[0].conditions,
    "has:replayId",
  );
  assert.ok(dashboard.widgets.some(({ title }) => title === "사용자 ID 행동"));
  assert.ok(dashboard.widgets.some(({ title }) => title === "최근 개인정보 JIT 상태"));
});

test("서비스 오류 대시보드는 공통 프로젝트와 전용 프로젝트 3개를 모두 조회한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 업무 오류 분석");

  assert.deepEqual(dashboard.projects, [2, 3, 4, 5]);
  assert.ok(dashboard.widgets.some(({ title }) => title === "전용 프로젝트별 오류"));
});
