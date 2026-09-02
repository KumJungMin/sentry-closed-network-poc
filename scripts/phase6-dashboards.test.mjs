import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboards = JSON.parse(await readFile(new URL("./phase6-dashboards.json", import.meta.url), "utf8"));

test("일간·주간·월간 오류 대시보드의 저장 기간을 고정한다", () => {
  const periods = Object.fromEntries(
    dashboards
      .filter(({ title }) => title.startsWith("PoC - Errors "))
      .map(({ title, period }) => [title, period]),
  );
  assert.deepEqual(periods, {
    "PoC - Errors Daily (24h)": "24h",
    "PoC - Errors Weekly (7d)": "7d",
    "PoC - Errors Monthly (30d)": "30d",
  });
});

test("각 기간 대시보드는 오류·사용자·추이·순위를 모두 제공한다", () => {
  for (const dashboard of dashboards.filter(({ title }) => title.startsWith("PoC - Errors "))) {
    assert.equal(dashboard.widgets.length, 4);
    assert.ok(dashboard.widgets.some(({ title }) => title.startsWith("Affected Users")));
    assert.ok(dashboard.widgets.some(({ title }) => title.startsWith("Top Errors")));
  }
});

test("성능 대시보드는 전체 및 페이지별 Performance Score와 Web Vitals를 함께 제공한다", () => {
  const dashboard = dashboards.find(({ title }) => title === "PoC - API and Frontend Performance");
  const scoreFormula = "performance_score(measurements.score.total)";
  assert.ok(dashboard.widgets.some(({ title }) => title === "Overall Performance Score"));

  const pageWidget = dashboard.widgets.find(({ title }) => title === "Web Vitals by Page");
  assert.ok(pageWidget.queries[0].fields.includes(scoreFormula));
  assert.ok(pageWidget.queries[0].fields.includes("p75(browser.web_vital.fcp.value)"));
  assert.ok(pageWidget.queries[0].fields.includes("p75(browser.web_vital.lcp.value)"));
});
