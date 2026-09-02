import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LiveLogsSection } from "./LiveLogsSection";

const loggingMocks = vi.hoisted(() => ({
  emitStructuredLog: vi.fn(async () => "frontend_action_completed"),
  logScenarios: [{
    id: "action-completed",
    level: "info",
    title: "정상 업무 로그",
    message: "frontend_action_completed",
    description: "설명",
  }],
}));

vi.mock("../sentry/logging", () => loggingMocks);

describe("LiveLogsSection", () => {
  it("구조화 로그를 전송하고 검색 위치를 안내한다", async () => {
    const user = userEvent.setup();
    render(<LiveLogsSection isSentryEnabled logsEnabled />);
    await user.click(screen.getByRole("button", { name: "로그 전송" }));
    expect(loggingMocks.emitStructuredLog).toHaveBeenCalledWith("action-completed");
    expect(await screen.findByText(/Explore > Logs/)).toBeTruthy();
  });

  it("Logs가 꺼져 있으면 전송하지 않는다", () => {
    render(<LiveLogsSection isSentryEnabled logsEnabled={false} />);
    expect(screen.getByRole("button", { name: "Logs 연결 필요" }).hasAttribute("disabled")).toBe(true);
  });
});
