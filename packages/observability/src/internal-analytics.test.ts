import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createObservedFlowEventSink,
  sendFlowAnalyticsEvent,
} from "./internal-analytics.js";

const sentryMocks = vi.hoisted(() => ({ logger: { warn: vi.fn() } }));
const telemetryMocks = vi.hoisted(() => ({ recordFlowEvent: vi.fn() }));

vi.mock("@sentry/react", () => sentryMocks);
vi.mock("./flow-telemetry.js", () => telemetryMocks);

const input = {
  attemptId: "attempt_v1_payment-flow-001",
  userId: "CUSTOMER-001",
  flowName: "payment",
  step: "order",
  event: "step_viewed",
} as const;

describe("내부 플로우 집계 전송", () => {
  beforeEach(() => vi.clearAllMocks());

  it("허용된 플로우 계약만 내부 API로 보낸다", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await sendFlowAnalyticsEvent({ ...input, cardNumber: "not-allowed" } as typeof input, { fetcher });

    const request = fetcher.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(fetcher).toHaveBeenCalledWith("/internal-api/analytics/events", expect.objectContaining({
      method: "POST",
      keepalive: true,
    }));
    expect(body).toMatchObject({
      userId: "CUSTOMER-001",
      flowName: "payment",
      step: "order",
      pagePath: "/payment/order",
    });
    expect(body.cardNumber).toBeUndefined();
  });

  it("Sentry 기록과 내부 집계 전송을 함께 실행한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await createObservedFlowEventSink({ fetcher })(input);

    expect(telemetryMocks.recordFlowEvent).toHaveBeenCalledWith(input);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("내부 집계 실패를 Sentry 경고 로그로 남긴다", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    await expect(sendFlowAnalyticsEvent(input, { fetcher })).rejects.toThrow("HTTP 503");

    expect(sentryMocks.logger.warn).toHaveBeenCalledWith(
      "internal_flow_analytics_failed",
      expect.objectContaining({ "flow.attempt_id": input.attemptId }),
    );
  });
});
