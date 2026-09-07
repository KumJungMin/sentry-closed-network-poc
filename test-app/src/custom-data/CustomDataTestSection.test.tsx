import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomDataTestSection } from "./CustomDataTestSection";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "phase5-event-id"),
  flush: vi.fn(async () => true),
  withScope: vi.fn(),
}));

const scopeMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
  setTags: vi.fn(),
}));

vi.mock("@sentry/react", () => sentryMocks);

describe("CustomDataTestSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryMocks.captureException.mockReturnValue("phase5-event-id");
    sentryMocks.flush.mockResolvedValue(true);
    sentryMocks.withScope.mockImplementation((callback) => callback(scopeMocks));
  });

  it("내장 필드와 데이터 분류 기준을 표시한다", () => {
    render(
      <CustomDataTestSection
        environment="local"
        release="frontend-poc@0.1.0"
        isSentryEnabled
      />,
    );

    expect(screen.getByText("local")).toBeTruthy();
    expect(screen.getByText("frontend-poc@0.1.0")).toBeTruthy();
    expect(screen.getByText("어디에 저장하나?")).toBeTruthy();
    expect(screen.getByText(/금액, 수취인 원문/)).toBeTruthy();
  });

  it("선택한 업무값을 Tag와 Context, 여섯 Breadcrumb로 전송한다", async () => {
    const user = userEvent.setup();
    render(
      <CustomDataTestSection
        environment="local"
        release="frontend-poc@0.1.0"
        isSentryEnabled
      />,
    );

    await user.selectOptions(screen.getByLabelText("채널"), "panda");
    await user.selectOptions(screen.getByLabelText("서비스"), "payment");
    await user.selectOptions(screen.getByLabelText("통화"), "USD");
    await user.clear(screen.getByLabelText("오류 코드"));
    await user.type(screen.getByLabelText("오류 코드"), "PAYMENT_AUTH_FAILED");
    await user.clear(screen.getByLabelText("화면"));
    await user.type(screen.getByLabelText("화면"), "payment-confirm");
    await user.selectOptions(screen.getByLabelText("처리 단계"), "payment-authorization");
    await user.selectOptions(screen.getByLabelText("인증 방식"), "biometric");
    await user.selectOptions(screen.getByLabelText("API 상태"), "timeout");
    await user.selectOptions(screen.getByLabelText("업무 상태"), "awaiting-retry");
    await user.click(screen.getByRole("button", { name: "업무 오류 전송" }));

    expect(await screen.findByText("금융 WebView 사용자 지정 이벤트를 전송했습니다.")).toBeTruthy();
    expect(scopeMocks.setTags).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "panda",
        service: "payment",
        currency: "USD",
        error_code: "PAYMENT_AUTH_FAILED",
        process_step: "payment-authorization",
      }),
    );
    expect(scopeMocks.setContext).toHaveBeenCalledWith(
      "financial_webview_state",
      expect.objectContaining({
        authentication_method: "biometric",
        api_status: "timeout",
        contains_personal_data: false,
      }),
    );
    expect(scopeMocks.addBreadcrumb).toHaveBeenCalledTimes(6);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "[PoC] Financial WebView business error" }),
    );
    expect(sentryMocks.flush).toHaveBeenCalledWith(2000);
  });

  it("잘못된 검색 필드를 전송하지 않고 오류를 안내한다", async () => {
    const user = userEvent.setup();
    render(
      <CustomDataTestSection
        environment="local"
        release="frontend-poc@0.1.0"
        isSentryEnabled
      />,
    );

    await user.clear(screen.getByLabelText("오류 코드"));
    await user.type(screen.getByLabelText("오류 코드"), "invalid code");
    await user.click(screen.getByRole("button", { name: "업무 오류 전송" }));

    expect((await screen.findByRole("alert")).textContent).toContain("오류 코드는");
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("SDK가 연결되지 않으면 전송 버튼을 비활성화한다", () => {
    render(
      <CustomDataTestSection
        environment="local"
        release="frontend-poc@0.1.0"
        isSentryEnabled={false}
      />,
    );

    expect(screen.getByRole("button", { name: "SDK 연결 필요" }).hasAttribute("disabled")).toBe(
      true,
    );
  });
});
