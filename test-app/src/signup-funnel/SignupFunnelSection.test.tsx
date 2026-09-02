import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupFunnelSection } from "./SignupFunnelSection";

const apiMocks = vi.hoisted(() => ({
  fetchFunnelSummary: vi.fn(),
  recordFunnelEvent: vi.fn(),
}));

vi.mock("./funnelApi", () => apiMocks);

describe("SignupFunnelSection", () => {
  beforeEach(() => {
    apiMocks.recordFunnelEvent.mockResolvedValue(undefined);
    apiMocks.fetchFunnelSummary.mockResolvedValue({
      generatedAt: "2026-09-02T00:00:00.000Z",
      totalAttempts: 4,
      completedAttempts: 1,
      steps: [
        { id: "terms", label: "약관 동의", reached: 4, dropOff: 1, dropOffRate: 25, conversionRate: 75 },
        { id: "account", label: "계좌 인증", reached: 3, dropOff: 1, dropOffRate: 33.3, conversionRate: 50 },
        { id: "phone", label: "휴대폰 인증", reached: 2, dropOff: 1, dropOffRate: 50, conversionRate: 25 },
        { id: "cdd", label: "CDD", reached: 1, dropOff: 0, dropOffRate: 0, conversionRate: 25 },
      ],
    });
  });

  it("내부 집계 결과와 네 단계 화면을 표시한다", async () => {
    render(<SignupFunnelSection />);
    expect(await screen.findByText("망 내부 집계 서버 연결됨")).toBeTruthy();
    expect(screen.getByText("전체 가입 시도").parentElement?.textContent).toContain("4");
    expect(screen.getByRole("list", { name: "가입 단계" }).children).toHaveLength(4);
  });

  it("화면 진입과 다음 화면 전환을 가입 시도 ID로 기록한다", async () => {
    const user = userEvent.setup();
    render(<SignupFunnelSection />);
    await screen.findByText("망 내부 집계 서버 연결됨");

    await user.click(screen.getByRole("button", { name: "가입 플로우 시작" }));
    expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      expect.stringMatching(/^attempt_v1_/),
      "terms",
      "entered",
    );

    await user.click(screen.getByRole("button", { name: "다음 화면" }));
    expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(expect.any(String), "terms", "advanced");
    expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(expect.any(String), "account", "entered");
  });
});
