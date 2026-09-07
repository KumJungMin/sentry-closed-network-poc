import { describe, expect, it, vi } from "vitest";
import { publishFlowFunnelSnapshot } from "./flow-snapshot.js";

const sentryMocks = vi.hoisted(() => ({
  startInactiveSpan: vi.fn(),
  spanEnd: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  startInactiveSpan: sentryMocks.startInactiveSpan,
}));

describe("정확한 플로우 집계 snapshot", () => {
  it("고객 식별자 없이 단계별 정확 집계를 span으로 발행한다", () => {
    sentryMocks.startInactiveSpan.mockReturnValue({ end: sentryMocks.spanEnd });
    publishFlowFunnelSnapshot({
      flowName: "payment",
      flowVersion: 1,
      service: "frontend-payment",
      dropOffGracePeriodMs: 300_000,
      totalAttempts: 3,
      completedAttempts: 1,
      steps: [{
        id: "order",
        label: "주문 확인",
        path: "/payment/order",
        reached: 3,
        progressed: 2,
        dropOff: 1,
        pendingDropOff: 0,
        dropOffRate: 33.3,
        conversionRate: 66.7,
      }],
    });

    expect(sentryMocks.startInactiveSpan).toHaveBeenCalledWith(expect.objectContaining({
      op: "poc.flow.snapshot",
      attributes: expect.objectContaining({
        "flow.slug": "payment",
        "flow.step": "order",
        "flow.reached": 3,
        "flow.drop_off": 1,
        "flow.drop_off_rate": 33.3,
      }),
    }));
    expect(JSON.stringify(sentryMocks.startInactiveSpan.mock.calls[0][0])).not.toContain("user");
    expect(sentryMocks.spanEnd).toHaveBeenCalledTimes(1);
  });
});
