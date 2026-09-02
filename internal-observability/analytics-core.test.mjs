import assert from "node:assert/strict";
import test from "node:test";
import { calculateFunnel, normalizeAnalyticsEvent } from "./analytics-core.mjs";

test("허용된 가입 이벤트만 최소 필드로 정규화한다", () => {
  const now = new Date("2026-09-02T00:00:00.000Z");
  assert.deepEqual(
    normalizeAnalyticsEvent({
      attemptId: "attempt_v1_123456789abc",
      step: "terms",
      event: "entered",
      service: "forged",
      email: "must-not-be-stored@example.invalid",
    }, now),
    {
      attemptId: "attempt_v1_123456789abc",
      step: "terms",
      event: "entered",
      service: "membership",
      occurredAt: now.toISOString(),
    },
  );
});

test("단계별 도달·이탈·전체 전환율을 가입 시도 기준으로 계산한다", () => {
  const entered = (attemptId, step) => ({ attemptId, step, event: "entered" });
  const events = [
    entered("attempt_v1_first-user-01", "terms"),
    entered("attempt_v1_first-user-01", "account"),
    entered("attempt_v1_first-user-01", "phone"),
    entered("attempt_v1_first-user-01", "cdd"),
    { attemptId: "attempt_v1_first-user-01", step: "cdd", event: "completed" },
    entered("attempt_v1_second-user-02", "terms"),
  ];

  const funnel = calculateFunnel(events);
  assert.equal(funnel.totalAttempts, 2);
  assert.equal(funnel.completedAttempts, 1);
  assert.deepEqual(funnel.steps[0], {
    id: "terms",
    label: "약관 동의",
    reached: 2,
    dropOff: 1,
    dropOffRate: 50,
    conversionRate: 50,
  });
  assert.equal(funnel.steps[3].conversionRate, 50);
});
