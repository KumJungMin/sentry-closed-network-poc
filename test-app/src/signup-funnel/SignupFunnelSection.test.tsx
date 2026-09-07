import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLocation, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignupFunnelSection } from "./SignupFunnelSection";
import { readFunnelSession, writeFunnelSession } from "./funnelSession";

const apiMocks = vi.hoisted(() => ({
  fetchFunnelSummary: vi.fn(),
  recordFunnelEvent: vi.fn(),
}));

vi.mock("./funnelApi", () => apiMocks);

const summary = {
  generatedAt: "2026-09-02T00:00:00.000Z",
  dropOffGracePeriodMs: 30 * 60 * 1000,
  totalAttempts: 4,
  completedAttempts: 1,
  steps: [
    { id: "terms", label: "약관 동의", reached: 4, dropOff: 1, pendingDropOff: 1, dropOffRate: 25, conversionRate: 50 },
    { id: "account", label: "계좌 인증", reached: 2, dropOff: 1, pendingDropOff: 0, dropOffRate: 50, conversionRate: 25 },
    { id: "phone", label: "휴대폰 인증", reached: 1, dropOff: 0, pendingDropOff: 0, dropOffRate: 0, conversionRate: 25 },
    { id: "cdd", label: "CDD", reached: 1, dropOff: 0, pendingDropOff: 0, dropOffRate: 0, conversionRate: 25 },
  ],
};

function LocationProbe() {
  return <output aria-label="현재 경로">{useLocation().pathname}</output>;
}

function renderFunnel(path = "/signup-funnel") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/signup-funnel" element={<SignupFunnelSection />} />
        <Route path="/signup-funnel/terms" element={<SignupFunnelSection currentStep="terms" />} />
        <Route path="/signup-funnel/account" element={<SignupFunnelSection currentStep="account" />} />
        <Route path="/signup-funnel/phone" element={<SignupFunnelSection currentStep="phone" />} />
        <Route path="/signup-funnel/cdd" element={<SignupFunnelSection currentStep="cdd" />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("SignupFunnelSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    apiMocks.recordFunnelEvent.mockResolvedValue(undefined);
    apiMocks.fetchFunnelSummary.mockResolvedValue(summary);
  });

  it("내부 집계 결과와 pageView 이탈 정책을 표시한다", async () => {
    renderFunnel();

    expect(await screen.findByText("망 내부 집계 서버 연결됨")).toBeTruthy();
    expect(screen.getByText("전체 가입 시도").parentElement?.textContent).toContain("4");
    expect(screen.getByText("다음 pageView가 없으면 30분 후 이탈 확정으로 집계합니다.")).toBeTruthy();
    expect(screen.getAllByText("이탈 판단 대기")).toHaveLength(4);
  });

  it("유예시간이 0이면 즉시 이탈 확정 정책을 표시한다", async () => {
    apiMocks.fetchFunnelSummary.mockResolvedValue({ ...summary, dropOffGracePeriodMs: 0 });

    renderFunnel();

    expect(await screen.findByText("다음 pageView가 없으면 즉시 이탈 확정으로 집계합니다.")).toBeTruthy();
  });

  it("시작하면 첫 URL로 이동하고 화면 진입을 pageView로 자동 기록한다", async () => {
    const user = userEvent.setup();
    renderFunnel();

    await user.click(screen.getByRole("button", { name: "가입 시작" }));

    await waitFor(() => expect(screen.getByLabelText("현재 경로").textContent).toBe("/signup-funnel/terms"));
    await waitFor(() => expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      expect.stringMatching(/^attempt_v1_/),
      "terms",
      "page_view",
    ));
  });

  it("다음 버튼은 advanced를 기록하고 다음 URL의 pageView까지 기록한다", async () => {
    const user = userEvent.setup();
    renderFunnel();
    await user.click(screen.getByRole("button", { name: "가입 시작" }));
    await screen.findByText("현재 화면 진입 기록 완료");

    await user.click(screen.getByRole("button", { name: "다음 화면" }));

    await waitFor(() => expect(screen.getByLabelText("현재 경로").textContent).toBe("/signup-funnel/account"));
    expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(expect.any(String), "terms", "advanced");
    await waitFor(() => expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      expect.any(String),
      "account",
      "page_view",
    ));
  });

  it("세션 없이 중간 URL에 직접 진입하면 첫 단계로 복구한다", async () => {
    renderFunnel("/signup-funnel/account");

    await waitFor(() => expect(screen.getByLabelText("현재 경로").textContent).toBe("/signup-funnel/terms"));
    await waitFor(() => expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      expect.any(String),
      "terms",
      "page_view",
    ));
    expect(apiMocks.recordFunnelEvent).not.toHaveBeenCalledWith(
      expect.any(String),
      "account",
      "page_view",
    );
  });

  it("새로고침된 단계는 세션의 동일 가입 시도로 pageView를 다시 기록한다", async () => {
    writeFunnelSession({
      attemptId: "attempt_v1_123456789abc",
      furthestStep: "account",
    });

    renderFunnel("/signup-funnel/account");

    await waitFor(() => expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      "attempt_v1_123456789abc",
      "account",
      "page_view",
    ));
  });

  it("허용된 단계보다 앞선 URL 접근은 마지막 허용 단계로 복구한다", async () => {
    writeFunnelSession({
      attemptId: "attempt_v1_123456789abc",
      furthestStep: "account",
    });

    renderFunnel("/signup-funnel/cdd");

    await waitFor(() => expect(screen.getByLabelText("현재 경로").textContent).toBe("/signup-funnel/account"));
    await waitFor(() => expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      "attempt_v1_123456789abc",
      "account",
      "page_view",
    ));
  });

  it("pageView 저장 실패 시 진행을 막고 재시도를 제공한다", async () => {
    apiMocks.recordFunnelEvent.mockRejectedValueOnce(new Error("가입 퍼널 이벤트 저장에 실패했습니다."));
    const user = userEvent.setup();
    renderFunnel("/signup-funnel/terms");

    const retry = await screen.findByRole("button", { name: "화면 진입 다시 기록" });
    expect(screen.getByRole("button", { name: "다음 화면" }).hasAttribute("disabled")).toBe(true);

    await user.click(retry);

    await screen.findByText("현재 화면 진입 기록 완료");
    expect(screen.getByRole("button", { name: "다음 화면" }).hasAttribute("disabled")).toBe(false);
  });

  it("명시 이탈을 기록하고 가입 시도를 종료한다", async () => {
    const user = userEvent.setup();
    renderFunnel("/signup-funnel/terms");
    await screen.findByText("현재 화면 진입 기록 완료");

    await user.click(screen.getByRole("button", { name: "여기서 이탈" }));

    await waitFor(() => expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      expect.any(String),
      "terms",
      "abandoned",
    ));
    await waitFor(() => expect(screen.getByLabelText("현재 경로").textContent).toBe("/signup-funnel"));
  });

  it("네 화면을 모두 통과하면 완료 이벤트와 함께 세션을 종료한다", async () => {
    const user = userEvent.setup();
    renderFunnel();

    await user.click(screen.getByRole("button", { name: "가입 시작" }));
    for (const expectedPath of [
      "/signup-funnel/account",
      "/signup-funnel/phone",
      "/signup-funnel/cdd",
    ]) {
      await screen.findByText("현재 화면 진입 기록 완료");
      await user.click(screen.getByRole("button", { name: "다음 화면" }));
      await waitFor(() => expect(screen.getByLabelText("현재 경로").textContent).toBe(expectedPath));
    }

    await screen.findByText("현재 화면 진입 기록 완료");
    await user.click(screen.getByRole("button", { name: "가입 완료" }));

    await waitFor(() => expect(apiMocks.recordFunnelEvent).toHaveBeenCalledWith(
      expect.any(String),
      "cdd",
      "completed",
    ));
    await waitFor(() => expect(screen.getByLabelText("현재 경로").textContent).toBe("/signup-funnel"));
    expect(readFunnelSession()).toBeNull();
  });
});
