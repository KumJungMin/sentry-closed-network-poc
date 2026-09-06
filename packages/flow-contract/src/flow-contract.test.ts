import { describe, expect, it } from "vitest";
import {
  FLOW_DEFINITIONS,
  createFlowEvent,
  getNextFlowStep,
  isFlowStepId,
  isTerminalFlowStep,
  reduceFlowState,
} from "./index.js";

describe("도메인 플로우 계약", () => {
  it("세 플로우의 URL과 유예시간을 고정한다", () => {
    expect(FLOW_DEFINITIONS.membership.steps.map(({ path }) => path)).toEqual([
      "/signup/terms",
      "/signup/account",
      "/signup/phone",
      "/signup/identity",
      "/signup/complete",
    ]);
    expect(FLOW_DEFINITIONS.remittance.dropOffGracePeriodMs).toBe(15 * 60 * 1_000);
    expect(FLOW_DEFINITIONS.payment.dropOffGracePeriodMs).toBe(5 * 60 * 1_000);

    const paths = Object.values(FLOW_DEFINITIONS).flatMap(({ steps }) => steps.map(({ path }) => path));
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("다음 단계와 마지막 단계를 판별한다", () => {
    expect(getNextFlowStep("remittance", "recipient")?.id).toBe("amount");
    expect(getNextFlowStep("remittance", "result")).toBeUndefined();
    expect(isTerminalFlowStep("payment", "result")).toBe(true);
    expect(isFlowStepId("payment", "method")).toBe(true);
    expect(isFlowStepId("membership", "method")).toBe(false);
  });

  it("이벤트를 허용 필드만으로 정규화한다", () => {
    const event = createFlowEvent({
      attemptId: "attempt_v1_membership-001",
      flowName: "membership",
      step: "terms",
      event: "flow_started",
    }, new Date("2026-09-07T00:00:00.000Z"));

    expect(event).toEqual({
      schemaVersion: 1,
      attemptId: "attempt_v1_membership-001",
      flowName: "membership",
      flowVersion: 1,
      step: "terms",
      event: "flow_started",
      pagePath: "/signup/terms",
      service: "frontend-membership",
      occurredAt: "2026-09-07T00:00:00.000Z",
    });
  });

  it("원본 user.id를 변경하지 않는다", () => {
    const event = createFlowEvent({
      attemptId: "attempt_v1_raw-user-0001",
      userId: "CUSTOMER-원본-001",
      flowName: "payment",
      step: "order",
      event: "step_viewed",
    });

    expect(event.userId).toBe("CUSTOMER-원본-001");
  });

  it("잘못된 플로우 단계와 완료 이벤트를 거부한다", () => {
    expect(() => createFlowEvent({
      attemptId: "attempt_v1_invalid-step-01",
      flowName: "membership",
      step: "method",
      event: "step_viewed",
    })).toThrow("현재 플로우에 속하지 않은 단계입니다.");

    expect(() => createFlowEvent({
      attemptId: "attempt_v1_early-complete",
      flowName: "payment",
      step: "review",
      event: "flow_completed",
    })).toThrow("플로우 완료 이벤트는 마지막 단계에서만 기록할 수 있습니다.");
  });

  it("이벤트로 관측 상태를 계산한다", () => {
    const event = createFlowEvent({
      attemptId: "attempt_v1_declined-0001",
      flowName: "payment",
      step: "authenticate",
      event: "step_failed",
      outcome: "business_decline",
      errorCode: "PAYMENT_DECLINED",
    });

    expect(reduceFlowState("submitting", event)).toBe("recoverable_error");
  });
});
