import { beforeEach, describe, expect, it, vi } from "vitest";
import { activateCustomerIdentity, clearCustomerIdentity } from "./identityApi";

const telemetryMocks = vi.hoisted(() => ({
  recordIdentifiedUserBehavior: vi.fn(),
}));
const sentryState = vi.hoisted(() => ({
  user: undefined as { id: string } | undefined,
}));
const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  getCurrentScope: vi.fn(() => ({ getUser: () => sentryState.user })),
  setTag: vi.fn(),
  setUser: vi.fn(),
}));

vi.mock("../sentry/dashboardTelemetry", () => telemetryMocks);
vi.mock("@sentry/react", () => sentryMocks);

describe("identityApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sentryState.user = undefined;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      pseudonymousId: "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH",
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
  });

  it("원본 고객 ID를 Sentry scope에 연결하고 내부용 HMAC ID를 반환한다", async () => {
    const identity = await activateCustomerIdentity(" 123e4567-e89b-42d3-a456-426614174000 ");

    expect(identity).toEqual({
      customerId: "123e4567-e89b-42d3-a456-426614174000",
      pseudonymousId: "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH",
    });
    expect(sentryMocks.setUser).toHaveBeenCalledWith({ id: identity.customerId });
    expect(telemetryMocks.recordIdentifiedUserBehavior)
      .toHaveBeenCalledWith("identity_activated", identity.customerId);
  });

  it("빈 고객 ID는 연결하지 않는다", async () => {
    await expect(activateCustomerIdentity("   ")).rejects.toThrow("고객 ID를 입력하세요.");
    expect(fetch).not.toHaveBeenCalled();
    expect(sentryMocks.setUser).not.toHaveBeenCalled();
  });

  it("연결 해제 전에 현재 원본 고객 ID 행동을 기록한다", () => {
    sentryState.user = { id: "customer-raw-id-1042" };

    clearCustomerIdentity();

    expect(telemetryMocks.recordIdentifiedUserBehavior)
      .toHaveBeenCalledWith("identity_cleared", "customer-raw-id-1042");
    expect(sentryMocks.setUser).toHaveBeenCalledWith(null);
  });
});
