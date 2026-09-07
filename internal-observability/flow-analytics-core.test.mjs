import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAllFlowFunnels,
  calculateFlowFunnel,
  normalizeFlowAnalyticsEvent,
} from "./flow-analytics-core.mjs";

const viewed = (attemptId, flowName, step, occurredAt) => ({
  attemptId,
  flowName,
  step,
  event: "step_viewed",
  occurredAt,
});

test("세 도메인 이벤트를 허용 필드만으로 정규화한다", () => {
  assert.deepEqual(normalizeFlowAnalyticsEvent({
    attemptId: "attempt_v1_payment-user-01",
    userId: "CUSTOMER-원본-001",
    flowName: "payment",
    step: "method",
    event: "step_viewed",
    cardNumber: "must-not-be-stored",
  }, new Date("2026-09-07T00:00:00.000Z")), {
    schemaVersion: 1,
    attemptId: "attempt_v1_payment-user-01",
    userId: "CUSTOMER-원본-001",
    flowName: "payment",
    flowVersion: 1,
    step: "method",
    event: "step_viewed",
    pagePath: "/payment/method",
    service: "frontend-payment",
    occurredAt: "2026-09-07T00:00:00.000Z",
  });
});

test("플로우마다 다른 유예시간으로 정확한 이탈률을 계산한다", () => {
  const events = [
    viewed("attempt_v1_payment-done-01", "payment", "order", "2026-09-07T00:00:00.000Z"),
    viewed("attempt_v1_payment-done-01", "payment", "method", "2026-09-07T00:01:00.000Z"),
    viewed("attempt_v1_payment-drop-02", "payment", "order", "2026-09-07T00:00:00.000Z"),
    viewed("attempt_v1_payment-wait-03", "payment", "order", "2026-09-07T00:08:00.000Z"),
  ];
  const summary = calculateFlowFunnel(events, {
    flowName: "payment",
    now: new Date("2026-09-07T00:10:00.000Z"),
  });

  assert.equal(summary.dropOffGracePeriodMs, 5 * 60 * 1000);
  assert.equal(summary.totalAttempts, 3);
  assert.deepEqual(summary.steps[0], {
    id: "order",
    label: "주문 확인",
    path: "/payment/order",
    reached: 3,
    progressed: 1,
    dropOff: 1,
    pendingDropOff: 1,
    dropOffRate: 33.3,
    conversionRate: 33.3,
  });
});

test("다른 플로우와 같은 attempt ID가 있어도 집계를 섞지 않는다", () => {
  const attemptId = "attempt_v1_shared-user-001";
  const summaries = calculateAllFlowFunnels([
    viewed(attemptId, "membership", "terms", "2026-09-07T00:00:00.000Z"),
    viewed(attemptId, "remittance", "recipient", "2026-09-07T00:00:00.000Z"),
  ], { now: new Date("2026-09-07T01:00:00.000Z") });

  assert.equal(summaries.membership.totalAttempts, 1);
  assert.equal(summaries.remittance.totalAttempts, 1);
  assert.equal(summaries.payment.totalAttempts, 0);
});

test("명시적 취소 뒤 다음 단계에 도달하면 이탈이 아니라 진행으로 본다", () => {
  const attemptId = "attempt_v1_resumed-user-01";
  const summary = calculateFlowFunnel([
    viewed(attemptId, "remittance", "recipient", "2026-09-07T00:00:00.000Z"),
    { attemptId, flowName: "remittance", step: "recipient", event: "flow_cancelled", occurredAt: "2026-09-07T00:01:00.000Z" },
    viewed(attemptId, "remittance", "amount", "2026-09-07T00:02:00.000Z"),
  ], {
    flowName: "remittance",
    now: new Date("2026-09-07T00:03:00.000Z"),
  });

  assert.equal(summary.steps[0].progressed, 1);
  assert.equal(summary.steps[0].dropOff, 0);
});
