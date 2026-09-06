import assert from "node:assert/strict";
import test from "node:test";
import { calculateFunnel, normalizeAnalyticsEvent } from "./analytics-core.mjs";

test("허용된 가입 이벤트만 최소 필드로 정규화한다", () => {
  const now = new Date("2026-09-02T00:00:00.000Z");
  assert.deepEqual(
    normalizeAnalyticsEvent({
      attemptId: "attempt_v1_123456789abc",
      step: "terms",
      event: "page_view",
      service: "forged",
      email: "must-not-be-stored@example.invalid",
    }, now),
    {
      attemptId: "attempt_v1_123456789abc",
      step: "terms",
      event: "page_view",
      pagePath: "/signup-funnel/terms",
      service: "membership",
      occurredAt: now.toISOString(),
    },
  );
});

test("pageView의 다음 화면 도달 여부와 유예시간으로 이탈을 확정한다", () => {
  const pageView = (attemptId, step, occurredAt) => ({
    attemptId,
    step,
    event: "page_view",
    occurredAt,
  });
  const events = [
    pageView("attempt_v1_first-user-01", "terms", "2026-09-02T00:00:00.000Z"),
    pageView("attempt_v1_first-user-01", "account", "2026-09-02T00:01:00.000Z"),
    pageView("attempt_v1_first-user-01", "phone", "2026-09-02T00:02:00.000Z"),
    pageView("attempt_v1_first-user-01", "cdd", "2026-09-02T00:03:00.000Z"),
    { attemptId: "attempt_v1_first-user-01", step: "cdd", event: "completed" },
    pageView("attempt_v1_second-user-02", "terms", "2026-09-02T00:00:00.000Z"),
    pageView("attempt_v1_pending-user-03", "terms", "2026-09-02T00:55:00.000Z"),
  ];

  const funnel = calculateFunnel(events, {
    now: new Date("2026-09-02T01:00:00.000Z"),
    dropOffGracePeriodMs: 30 * 60 * 1000,
  });
  assert.equal(funnel.totalAttempts, 3);
  assert.equal(funnel.completedAttempts, 1);
  assert.deepEqual(funnel.steps[0], {
    id: "terms",
    label: "약관 동의",
    reached: 3,
    dropOff: 1,
    pendingDropOff: 1,
    dropOffRate: 33.3,
    conversionRate: 33.3,
  });
  assert.equal(funnel.steps[3].conversionRate, 33.3);
});

test("명시 이탈은 유예시간 전에도 확정하지만 이후 다음 pageView가 있으면 전환으로 본다", () => {
  const now = new Date("2026-09-02T01:00:00.000Z");
  const events = [
    { attemptId: "attempt_v1_abandoned-001", step: "terms", event: "page_view", occurredAt: "2026-09-02T00:59:00.000Z" },
    { attemptId: "attempt_v1_abandoned-001", step: "terms", event: "abandoned", occurredAt: "2026-09-02T00:59:10.000Z" },
    { attemptId: "attempt_v1_resumed-user-02", step: "terms", event: "page_view", occurredAt: "2026-09-02T00:58:00.000Z" },
    { attemptId: "attempt_v1_resumed-user-02", step: "terms", event: "abandoned", occurredAt: "2026-09-02T00:58:10.000Z" },
    { attemptId: "attempt_v1_resumed-user-02", step: "account", event: "page_view", occurredAt: "2026-09-02T00:59:00.000Z" },
  ];

  const funnel = calculateFunnel(events, { now, dropOffGracePeriodMs: 30 * 60 * 1000 });
  assert.equal(funnel.steps[0].dropOff, 1);
  assert.equal(funnel.steps[0].pendingDropOff, 0);
  assert.equal(funnel.steps[0].conversionRate, 50);
});

test("기존 entered 데이터도 pageView로 계속 집계한다", () => {
  const funnel = calculateFunnel([
    {
      attemptId: "attempt_v1_legacy-user-01",
      step: "terms",
      event: "entered",
      occurredAt: "2026-09-02T00:00:00.000Z",
    },
  ], {
    now: new Date("2026-09-02T01:00:00.000Z"),
    dropOffGracePeriodMs: 30 * 60 * 1000,
  });

  assert.equal(funnel.totalAttempts, 1);
  assert.equal(funnel.steps[0].dropOff, 1);
});

test("같은 화면 새로고침은 도달을 중복시키지 않고 이탈 유예시간을 연장한다", () => {
  const attemptId = "attempt_v1_refresh-user-01";
  const funnel = calculateFunnel([
    { attemptId, step: "terms", event: "page_view", occurredAt: "2026-09-02T00:00:00.000Z" },
    { attemptId, step: "terms", event: "page_view", occurredAt: "2026-09-02T00:50:00.000Z" },
  ], {
    now: new Date("2026-09-02T01:00:00.000Z"),
    dropOffGracePeriodMs: 30 * 60 * 1000,
  });

  assert.equal(funnel.totalAttempts, 1);
  assert.equal(funnel.steps[0].dropOff, 0);
  assert.equal(funnel.steps[0].pendingDropOff, 1);
});
