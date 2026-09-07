import type { ErrorEvent } from "@sentry/react";
import { describe, expect, it } from "vitest";
import {
  buildCollectionPolicy,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeUrl,
} from "./privacy.js";

describe("공통 Sentry 개인정보 정책", () => {
  it("user.id만 원본으로 보존한다", () => {
    const sanitized = sanitizeSentryEvent({
      user: {
        id: "CUSTOMER-원본-001",
        email: "secret@example.com",
        username: "홍길동",
      },
      tags: { customer_id: "CUSTOMER-원본-001", safe_state: "review" },
    } as ErrorEvent);

    expect(sanitized.user).toEqual({ id: "CUSTOMER-원본-001" });
    expect(sanitized.tags).toEqual({ safe_state: "review" });
  });

  it("민감정보와 URL query를 제거한다", () => {
    const serialized = JSON.stringify(sanitizeSentryEvent({
      message: "failed for secret@example.com",
      transaction: "/payment/review?token=secret#confirm",
      request: {
        method: "POST",
        url: "http://127.0.0.1/payment?account=123-456-789",
        data: { account_number: "123-456-789" },
      },
      extra: { auth_code: "123456", retry_count: 2 },
    } as ErrorEvent));

    expect(serialized).not.toContain("secret@example.com");
    expect(serialized).not.toContain("123-456-789");
    expect(serialized).not.toContain("123456");
    expect(sanitizeUrl("/signup/phone?otp=123456#verify")).toBe("/signup/phone");
  });

  it("입력과 console breadcrumb를 폐기한다", () => {
    expect(sanitizeSentryBreadcrumb({ category: "ui.input", message: "secret" })).toBeNull();
    expect(sanitizeSentryBreadcrumb({ category: "console", message: "secret" })).toBeNull();
    expect(sanitizeSentryBreadcrumb({
      category: "navigation",
      data: { from: "/payment?token=secret", to: "/payment/result#done" },
    })).toEqual({
      category: "navigation",
      data: { from: "/payment", to: "/payment/result" },
    });
  });

  it("모든 환경에서 일반 세션 Replay 전송률을 0으로 고정한다", () => {
    expect(buildCollectionPolicy("local")).toEqual({
      tracesSampleRate: 1,
      replayEnabled: true,
      replaySessionSampleRate: 0,
      replayOnErrorSampleRate: 1,
    });
    expect(buildCollectionPolicy("production")).toEqual({
      tracesSampleRate: 0.1,
      replayEnabled: false,
      replaySessionSampleRate: 0,
      replayOnErrorSampleRate: 0,
    });
    expect(buildCollectionPolicy("production", undefined, "true", "0.25")).toMatchObject({
      replaySessionSampleRate: 0,
      replayOnErrorSampleRate: 0.25,
    });
  });
});
