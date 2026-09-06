import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  publishFunnelDashboardSnapshot,
  publishNormalizedDashboardSnapshot,
  recordIdentifiedUserBehavior,
  recordPrivacyDashboardState,
} from "./dashboardTelemetry";

const sentryMocks = vi.hoisted(() => ({
  gauge: vi.fn(),
  count: vi.fn(),
  loggerInfo: vi.fn(),
  spanEnd: vi.fn(),
}));

vi.mock("@sentry/react", () => ({
  metrics: { gauge: sentryMocks.gauge, count: sentryMocks.count },
  logger: { info: sentryMocks.loggerInfo },
  startInactiveSpan: vi.fn(() => ({ end: sentryMocks.spanEnd })),
}));

const funnel = {
  generatedAt: "2026-09-03T00:00:00.000Z",
  dropOffGracePeriodMs: 1_800_000,
  totalAttempts: 3,
  completedAttempts: 1,
  steps: [
    {
      id: "terms" as const,
      label: "약관 동의",
      reached: 3,
      dropOff: 1,
      pendingDropOff: 1,
      dropOffRate: 33.3,
      conversionRate: 66.7,
    },
  ],
};

describe("dashboardTelemetry", () => {
  beforeEach(() => vi.clearAllMocks());

  it("확정 이탈과 판정 대기를 서로 다른 gauge로 보낸다", () => {
    publishFunnelDashboardSnapshot(funnel);

    expect(sentryMocks.gauge).toHaveBeenCalledWith(
      "poc.signup.drop_off",
      1,
      expect.objectContaining({ attributes: expect.objectContaining({ "funnel.step": "terms" }) }),
    );
    expect(sentryMocks.gauge).toHaveBeenCalledWith(
      "poc.signup.pending_drop_off",
      1,
      expect.any(Object),
    );
    expect(sentryMocks.spanEnd).toHaveBeenCalledTimes(1);
  });

  it("활성 사용자 모수와 영향 사용자 비율을 dashboard gauge로 보낸다", () => {
    publishNormalizedDashboardSnapshot({
      generatedAt: funnel.generatedAt,
      funnel,
      errorRanking: [{
        service: "payment",
        issueKey: "synthetic.payment.timeout",
        errorEvents: 2,
        affectedUsers: 1,
        activeUsers: 4,
        affectedUserRate: 25,
      }],
    });

    expect(sentryMocks.gauge).toHaveBeenCalledWith(
      "poc.usage.affected_user_rate",
      25,
      expect.objectContaining({ attributes: expect.objectContaining({ service: "payment" }) }),
    );
  });

  it("개인정보 원문 없이 JIT 상태만 로그와 gauge로 보낸다", () => {
    recordPrivacyDashboardState("access_opened", true);

    expect(sentryMocks.loggerInfo).toHaveBeenCalledWith(
      "privacy_access_state_changed",
      expect.objectContaining({ action: "access_opened", access_state: "enabled" }),
    );
    expect(sentryMocks.gauge).toHaveBeenCalledWith("poc.privacy.access_enabled", 1, expect.any(Object));
  });

  it("원본 고객 ID를 사용자 행동 로그에 포함한다", () => {
    recordIdentifiedUserBehavior("identity_activated", "customer-raw-id-1042");

    expect(sentryMocks.loggerInfo).toHaveBeenCalledWith(
      "identified_user_behavior",
      expect.objectContaining({ "user.id": "customer-raw-id-1042" }),
    );
    expect(sentryMocks.count).toHaveBeenCalledWith("poc.user.behavior", 1, expect.any(Object));
  });
});
