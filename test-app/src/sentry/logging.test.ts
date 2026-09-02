import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitStructuredLog } from "./logging";

const sentryMocks = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  withScope: vi.fn(),
  captureException: vi.fn(),
  flush: vi.fn(),
}));
const scopeMocks = vi.hoisted(() => ({ setTags: vi.fn(), setContext: vi.fn() }));

vi.mock("@sentry/react", () => sentryMocks);

describe("구조화 프론트엔드 로그", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryMocks.flush.mockResolvedValue(true);
    sentryMocks.withScope.mockImplementation((callback) => callback(scopeMocks));
  });

  it("검색 가능한 고정 메시지와 허용 속성으로 info 로그를 보낸다", async () => {
    await emitStructuredLog("action-completed");
    expect(sentryMocks.logger.info).toHaveBeenCalledWith("frontend_action_completed", {
      service: "membership",
      page: "signup.terms",
      action: "accept_terms",
      source: "frontend-poc",
      synthetic: true,
    });
  });

  it("error 로그는 같은 service/page의 Issue와 연결한다", async () => {
    await emitStructuredLog("payment-failed");
    expect(sentryMocks.logger.error).toHaveBeenCalledTimes(1);
    expect(scopeMocks.setTags).toHaveBeenCalledWith({ service: "payment", page: "payment.confirm" });
    expect(sentryMocks.captureException).toHaveBeenCalledWith(expect.any(Error));
  });
});
