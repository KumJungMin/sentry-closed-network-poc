import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordFunnelEvent } from "./funnelApi";

const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  startSpan: vi.fn(async (_options: unknown, callback: () => Promise<void>) => callback()),
}));

vi.mock("@sentry/react", () => sentryMocks);

describe("funnelApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 202 })));
  });

  it("pageView URL과 가입 시도 ID를 내부 API와 Sentry span에 기록한다", async () => {
    await recordFunnelEvent("attempt_v1_123456789abc", "account", "page_view");

    expect(fetch).toHaveBeenCalledWith("/internal-api/analytics/events", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        attemptId: "attempt_v1_123456789abc",
        step: "account",
        event: "page_view",
      }),
    }));
    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ page: "/signup-funnel/account" }),
    }));
    expect(sentryMocks.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        op: "ui.funnel",
        attributes: expect.objectContaining({ "page.path": "/signup-funnel/account" }),
      }),
      expect.any(Function),
    );
  });

  it("내부 API가 거부하면 사용자 동작을 실패 처리한다", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));

    await expect(recordFunnelEvent(
      "attempt_v1_123456789abc",
      "terms",
      "page_view",
    )).rejects.toThrow("가입 퍼널 이벤트 저장에 실패했습니다.");
  });
});
