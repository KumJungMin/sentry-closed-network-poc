import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SecurityTestSection } from "./SecurityTestSection";
import { fakeSensitiveValues } from "./securityTest.core";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "phase7-event-id"),
  flush: vi.fn(async () => true),
  withScope: vi.fn(),
}));

const scopeMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
  setTags: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("@sentry/react", () => sentryMocks);

describe("SecurityTestSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryMocks.captureException.mockReturnValue("phase7-event-id");
    sentryMocks.flush.mockResolvedValue(true);
    sentryMocks.withScope.mockImplementation((callback) => callback(scopeMocks));
  });

  it("보호 정책과 실제 데이터 입력 금지 안내를 표시한다", () => {
    render(<SecurityTestSection environment="local" isSentryEnabled isReplayEnabled />);

    expect(screen.getByRole("heading", { name: "민감정보 비수집 검증" })).toBeTruthy();
    expect(screen.getByText("Session Replay").textContent).toContain("ON · 전체 마스킹");
    expect(screen.getByText("실제 개인정보를 입력하지 마세요.")).toBeTruthy();
    expect(screen.getByText("Authorization · Cookie")).toBeTruthy();
  });

  it("고정 합성값을 격리된 scope에 담아 보안 검증 이벤트를 전송한다", async () => {
    const user = userEvent.setup();
    render(<SecurityTestSection environment="local" isSentryEnabled isReplayEnabled />);

    await user.click(screen.getByRole("button", { name: "합성 민감정보 이벤트 전송" }));

    expect(await screen.findByText("합성 민감정보 이벤트를 보안 필터를 거쳐 전송했습니다.")).toBeTruthy();
    expect(scopeMocks.setUser).toHaveBeenCalledWith(expect.objectContaining({
      email: fakeSensitiveValues.email,
    }));
    expect(scopeMocks.setContext).toHaveBeenCalledWith(
      "phase7_sensitive_input",
      expect.objectContaining({ access_token: fakeSensitiveValues.accessToken }),
    );
    expect(scopeMocks.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "[PoC] Phase 7 privacy scrub verification" }),
    );
    expect(sentryMocks.flush).toHaveBeenCalledWith(3000);
  });

  it("SDK 미연결 시 전송 버튼을 비활성화한다", () => {
    render(<SecurityTestSection environment="local" isSentryEnabled={false} isReplayEnabled />);
    expect(screen.getByRole("button", { name: "SDK 연결 필요" }).hasAttribute("disabled")).toBe(true);
  });

  it("flush가 완료되지 않으면 성공으로 표시하지 않는다", async () => {
    sentryMocks.flush.mockResolvedValueOnce(false);
    const user = userEvent.setup();
    render(<SecurityTestSection environment="local" isSentryEnabled isReplayEnabled />);

    await user.click(screen.getByRole("button", { name: "합성 민감정보 이벤트 전송" }));

    expect(await screen.findByText("제한 시간 안에 Sentry 전송 완료를 확인하지 못했습니다.")).toBeTruthy();
  });
});
