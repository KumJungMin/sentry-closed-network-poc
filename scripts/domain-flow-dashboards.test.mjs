import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboards = JSON.parse(
  await readFile(new URL("./domain-flow-dashboards.json", import.meta.url), "utf8"),
);
const expectedProjectSlugs = [
  "frontend-membership",
  "frontend-remittance",
  "frontend-payment",
];

test("도메인 대시보드는 세 전용 프로젝트만 조회한다", () => {
  assert.equal(dashboards.length, 2);
  for (const dashboard of dashboards) {
    assert.deepEqual(dashboard.projectSlugs, expectedProjectSlugs);
    assert.equal("projects" in dashboard, false);
  }
});

test("현황 대시보드는 오류, Replay, 단계, URL 성능을 제공한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 도메인 프론트 현황");
  const titles = new Set(dashboard.widgets.map(({ title }) => title));
  assert.ok(titles.has("Replay 연결 오류"));
  assert.ok(titles.has("플로우 단계별 기술 오류"));
  assert.ok(titles.has("오류 코드별 기술 오류"));
  assert.ok(titles.has("URL별 화면 성능"));
  assert.ok(titles.has("플로우별 최신 정확 집계"));
});

test("정확한 이탈률 위젯은 확정 이탈과 판정 대기를 분리한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 도메인 프론트 현황");
  const widget = dashboard.widgets.find(({ title }) => title === "플로우별 최신 정확 집계");
  assert.equal(widget.widgetType, "spans");
  assert.ok(widget.queries[0].fields.includes("tags[flow.drop_off,number]"));
  assert.ok(widget.queries[0].fields.includes("tags[flow.pending_drop_off,number]"));
  assert.ok(widget.queries[0].fields.includes("tags[flow.drop_off_rate,number]"));
});

test("사용자 조사 대시보드는 user.id와 attempt ID를 함께 표시한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - 사용자 플로우 조사");
  const logWidget = dashboard.widgets.find(({ title }) => title === "최근 플로우 행동 로그");
  assert.equal(logWidget.queries[0].conditions, "has:flow.event");
  assert.ok(logWidget.queries[0].fields.includes("user.id"));
  assert.ok(logWidget.queries[0].fields.includes("flow.attempt_id"));

  const errorWidget = dashboard.widgets.find(({ title }) => title === "사용자와 Replay가 연결된 오류");
  assert.ok(errorWidget.queries[0].fields.includes("replayId"));
  assert.ok(errorWidget.queries[0].fields.includes("error_code"));
});

test("고카디널리티 attempt ID는 집계 groupBy에 사용하지 않는다", () => {
  const groupedQueries = dashboards.flatMap(({ widgets }) => widgets)
    .flatMap(({ queries }) => queries)
    .filter(({ aggregates }) => aggregates.length > 0);
  for (const query of groupedQueries) {
    assert.equal(query.columns.includes("flow.attempt_id"), false);
  }
});
