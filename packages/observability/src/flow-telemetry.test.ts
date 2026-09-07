import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureFlowException, recordFlowEvent } from "./flow-telemetry.js";

const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(() => "event-123"),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  setUser: vi.fn(),
  withScope: vi.fn(),
}));
const scopeMocks = vi.hoisted(() => ({
  setContext: vi.fn(),
  setTags: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  ...sentryMocks,
  wrapReactRouterRouting: vi.fn((component) => component),
}));

describe("플로우 Sentry 텔레메트리", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryMocks.withScope.mockImplementation((callback) => callback(scopeMocks));
  });

  it("사용자와 attempt가 연결된 구조화 로그를 보낸다", () => {
    recordFlowEvent({
      attemptId: "attempt_v1_membership-001",
      userId: "CUSTOMER-원본-001",
      flowName: "membership",
      step: "terms",
      event: "step_viewed",
    });

    expect(sentryMocks.setUser).toHaveBeenCalledWith({ id: "CUSTOMER-원본-001" });
    expect(sentryMocks.logger.info).toHaveBeenCalledWith("frontend_flow_event", expect.objectContaining({
      service: "frontend-membership",
      "flow.step": "terms",
      "flow.attempt_id": "attempt_v1_membership-001",
    }));
  });

  it("예상 업무 실패는 경고 로그만 만들고 Issue를 만들지 않는다", () => {
    recordFlowEvent({
      attemptId: "attempt_v1_payment-decline",
      userId: "CUSTOMER-002",
      flowName: "payment",
      step: "authenticate",
      event: "step_failed",
      outcome: "business_decline",
      errorCode: "PAYMENT_DECLINED",
    });

    expect(sentryMocks.logger.warn).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("기술 오류는 구조화 로그와 원본 Error Issue를 함께 만든다", () => {
    const error = new Error("mock timeout");
    const eventId = captureFlowException({
      attemptId: "attempt_v1_payment-timeout",
      userId: "CUSTOMER-003",
      flowName: "payment",
      step: "authenticate",
      errorCode: "PAYMENT_TIMEOUT",
      error,
    });

    expect(sentryMocks.logger.error).toHaveBeenCalledTimes(1);
    expect(scopeMocks.setTags).toHaveBeenCalledWith(expect.objectContaining({
      "flow.attempt_id": "attempt_v1_payment-timeout",
      error_code: "PAYMENT_TIMEOUT",
    }));
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(eventId).toBe("event-123");
  });
});
