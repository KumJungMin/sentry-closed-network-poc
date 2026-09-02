import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  callMissingApi,
  captureBreadcrumbError,
  captureBusinessMessage,
  captureHandledException,
  captureTagAndContextError,
  measureSlowOperation,
  triggerUnhandledError,
} from "./actions";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "exception-event-id"),
  captureMessage: vi.fn(() => "message-event-id"),
  startSpan: vi.fn(),
  withScope: vi.fn(),
}));

const scopeMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
}));

vi.mock("@sentry/react", () => sentryMocks);

describe("Sentry 테스트 action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryMocks.captureException.mockReturnValue("exception-event-id");
    sentryMocks.captureMessage.mockReturnValue("message-event-id");
    sentryMocks.withScope.mockImplementation((callback) => callback(scopeMocks));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("일반 JavaScript 오류를 다음 이벤트 루프에 예약한다", async () => {
    vi.useFakeTimers();

    const result = await triggerUnhandledError();

    expect(result.tone).toBe("scheduled");
    expect(vi.getTimerCount()).toBe(1);
  });

  it("API 네트워크 실패도 예외로 전송한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const result = await callMissingApi();

    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to fetch" }),
    );
    expect(result.tone).toBe("expected-error");
    expect(result.detail).toBe("Failed to fetch");
  });

  it("처리된 예외를 captureException으로 보낸다", async () => {
    const result = await captureHandledException();

    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "[PoC] Handled exception sent with captureException",
      }),
    );
    expect(result.detail).toContain("exception-event-id");
  });

  it("업무 메시지를 warning 레벨로 보낸다", async () => {
    const result = await captureBusinessMessage();

    expect(sentryMocks.captureMessage).toHaveBeenCalledWith(
      "[PoC] Remittance validation business warning",
      "warning",
    );
    expect(result.detail).toContain("message-event-id");
  });

  it("404 API 응답을 정제된 context와 함께 전송한다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));

    const result = await callMissingApi();

    expect(scopeMocks.setTag).toHaveBeenCalledWith("test_case", "failed-api");
    expect(scopeMocks.setContext).toHaveBeenCalledWith(
      "http_failure",
      expect.objectContaining({ status_code: 404 }),
    );
    expect(sentryMocks.captureException).toHaveBeenCalled();
    expect(result.tone).toBe("expected-error");
  });

  it("순서가 있는 Breadcrumb 세 개를 예외에 붙인다", async () => {
    await captureBreadcrumbError();

    expect(scopeMocks.addBreadcrumb).toHaveBeenCalledTimes(3);
    expect(scopeMocks.addBreadcrumb.mock.calls.map(([breadcrumb]) => breadcrumb.message)).toEqual([
      "송금 화면 진입",
      "금액 입력 완료",
      "수취인 검증 실패",
    ]);
    expect(sentryMocks.captureException).toHaveBeenCalled();
  });

  it("Tag와 Context를 격리된 scope에 추가한다", async () => {
    await captureTagAndContextError();

    expect(scopeMocks.setTags).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "hana-ez",
        service: "remittance",
        page: "transfer-review",
      }),
    );
    expect(scopeMocks.setContext).toHaveBeenCalledWith(
      "business_state",
      expect.objectContaining({ process_step: "recipient-validation" }),
    );
  });

  it("느린 작업을 사용자 지정 Span으로 측정한다", async () => {
    vi.useFakeTimers();
    const setAttribute = vi.fn();
    sentryMocks.startSpan.mockImplementation((_options, callback) => callback({ setAttribute }));

    const resultPromise = measureSlowOperation();
    await vi.advanceTimersByTimeAsync(1200);
    const result = await resultPromise;

    expect(sentryMocks.startSpan).toHaveBeenCalledWith(
      expect.objectContaining({ name: "poc.slow-operation", op: "ui.slow-task" }),
      expect.any(Function),
    );
    expect(setAttribute).toHaveBeenCalledWith("poc.result", "completed");
    expect(result.tone).toBe("sent");
  });
});
