import { describe, expect, it } from "vitest";
import { resolveObservabilityRuntime } from "./client.js";

describe("앱별 Sentry 런타임 설정", () => {
  it("DSN이 없거나 명시적으로 끄면 Sentry를 연결하지 않는다", () => {
    expect(resolveObservabilityRuntime({
      release: "membership-web@test",
      service: "frontend-membership",
    }).enabled).toBe(false);
    expect(resolveObservabilityRuntime({
      dsn: "http://public@example.invalid/1",
      enabled: false,
      release: "membership-web@test",
      service: "frontend-membership",
    }).enabled).toBe(false);
  });

  it("앱별 service와 release를 유지하고 일반 Replay는 끈다", () => {
    expect(resolveObservabilityRuntime({
      dsn: "http://public@example.invalid/2",
      environment: "local",
      release: "payment-web@abc123",
      service: "frontend-payment",
    })).toMatchObject({
      enabled: true,
      service: "frontend-payment",
      release: "payment-web@abc123",
      replaySessionSampleRate: 0,
      replayOnErrorSampleRate: 1,
    });
  });
});
