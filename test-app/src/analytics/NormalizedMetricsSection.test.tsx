import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NormalizedMetricsSection } from "./NormalizedMetricsSection";

const mocks = vi.hoisted(() => ({
  fetchNormalizedMetrics: vi.fn(async () => ({
    generatedAt: "now",
    errorRanking: [{ service: "payment", issueKey: "synthetic.payment.timeout", errorEvents: 2, affectedUsers: 1, activeUsers: 4, affectedUserRate: 25 }],
    funnel: { totalAttempts: 2, completedAttempts: 1, steps: [{ id: "terms", label: "약관 동의", reached: 2, dropOff: 1, dropOffRate: 50, conversionRate: 50 }] },
  })),
  recordUsageEvent: vi.fn(),
  emitStructuredLog: vi.fn(),
}));
vi.mock("./usageApi", () => ({ fetchNormalizedMetrics: mocks.fetchNormalizedMetrics, recordUsageEvent: mocks.recordUsageEvent }));
vi.mock("../sentry/logging", () => ({ emitStructuredLog: mocks.emitStructuredLog }));

describe("NormalizedMetricsSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("오류와 이탈을 사용자 모수 대비 비율로 표시한다", async () => {
    render(<NormalizedMetricsSection pseudonymousId="dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH" />);
    expect(await screen.findByText("25%")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("Sentry 오류와 내부 영향 사용자 이벤트를 함께 기록한다", async () => {
    const user = userEvent.setup();
    render(<NormalizedMetricsSection pseudonymousId="dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH" />);
    await screen.findByText("25%");
    await user.click(screen.getByRole("button", { name: "Sentry 오류 + 영향 사용자 기록" }));
    expect(mocks.emitStructuredLog).toHaveBeenCalledWith("payment-failed");
    expect(mocks.recordUsageEvent).toHaveBeenCalledWith(expect.objectContaining({ kind: "error" }));
  });

  it("모수 저장 실패를 상태 메시지로 표시한다", async () => {
    mocks.recordUsageEvent.mockRejectedValueOnce(new Error("집계 서버 저장 실패"));
    const user = userEvent.setup();
    render(<NormalizedMetricsSection pseudonymousId="dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH" />);
    await screen.findByText("25%");
    await user.click(screen.getByRole("button", { name: "정상 사용자 모수 +1" }));
    expect(await screen.findByText("집계 서버 저장 실패")).toBeTruthy();
  });
});
