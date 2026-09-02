import type { Breadcrumb, ErrorEvent } from "@sentry/react";
import { describe, expect, it } from "vitest";
import {
  buildCollectionPolicy,
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeUrl,
} from "./securityPolicy.core";
import { buildFakeSensitivePayload, fakeSensitiveValues } from "./securityTest.core";

describe("securityPolicy", () => {
  it("민감정보와 원문 payload를 전송 이벤트에서 제거한다", () => {
    const payload = buildFakeSensitivePayload();
    const event: ErrorEvent = {
      type: undefined,
      message: `phase7 ${fakeSensitiveValues.email}`,
      transaction: `/payment?account=${fakeSensitiveValues.accountNumber}#confirm`,
      user: payload.user,
      tags: {
        ...payload.tags,
        access_token: fakeSensitiveValues.accessToken,
        "browser.name": "Chrome",
      },
      contexts: { phase7_sensitive_input: payload.context },
      extra: {
        response_body: "FAKE-RAW-RESPONSE-PHASE7",
        safe_retry_count: 2,
      },
      request: {
        method: "POST",
        url: `http://127.0.0.1:5173/payment?email=${fakeSensitiveValues.email}#confirm`,
        headers: { Authorization: fakeSensitiveValues.authorization },
        data: { account_number: fakeSensitiveValues.accountNumber },
        cookies: { session: fakeSensitiveValues.cookie },
        query_string: `email=${fakeSensitiveValues.email}`,
      },
      breadcrumbs: [payload.breadcrumb],
      exception: {
        values: [{ type: "Error", value: `failed for ${fakeSensitiveValues.phone}` }],
      },
    };

    const sanitized = sanitizeSentryEvent(event);
    const serialized = JSON.stringify(sanitized);

    Object.values(fakeSensitiveValues).forEach((value) => {
      expect(serialized).not.toContain(value);
    });
    expect(sanitized.user).toBeUndefined();
    expect(sanitized.request).toEqual({ method: "POST", url: "http://127.0.0.1:5173/payment" });
    expect(sanitized.transaction).toBe("/payment");
    expect(sanitized.tags).toMatchObject({ security_phase: "phase7", "browser.name": "Chrome" });
    expect(sanitized.contexts?.phase7_sensitive_input).toEqual({
      request_url: "http://127.0.0.1:5173/payment",
      safe_business_state: "privacy-scrub-test",
    });
    expect(sanitized.extra).toEqual({ safe_retry_count: 2 });
  });

  it("서버가 발급한 가명 디버그 ID만 허용한다", () => {
    const sanitized = sanitizeSentryEvent({
      type: undefined,
      user: {
        id: "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH",
        email: fakeSensitiveValues.email,
        username: fakeSensitiveValues.name,
      },
    });

    expect(sanitized.user).toEqual({ id: "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH" });
  });

  it("입력·console breadcrumb는 폐기하고 HTTP breadcrumb는 정제한다", () => {
    expect(sanitizeSentryBreadcrumb({ category: "console", message: "secret" })).toBeNull();
    expect(sanitizeSentryBreadcrumb({ category: "ui.input", message: "typed" })).toBeNull();

    const breadcrumb: Breadcrumb = {
      category: "fetch",
      data: {
        url: `http://127.0.0.1/api?email=${fakeSensitiveValues.email}`,
        authorization: fakeSensitiveValues.authorization,
        status_code: 400,
      },
    };

    expect(sanitizeSentryBreadcrumb(breadcrumb)).toEqual({
      category: "fetch",
      data: { url: "http://127.0.0.1/api", status_code: 400 },
    });
  });

  it("로컬에서는 보호된 Replay를 켜고 운영에서는 명시적으로 승인해야 켠다", () => {
    expect(buildCollectionPolicy("local")).toEqual({
      tracesSampleRate: 1,
      replayEnabled: true,
      replaySessionSampleRate: 1,
      replayOnErrorSampleRate: 1,
    });
    expect(buildCollectionPolicy("production").tracesSampleRate).toBe(0.1);
    expect(buildCollectionPolicy("production").replayEnabled).toBe(false);
    expect(buildCollectionPolicy("uat").tracesSampleRate).toBe(0.5);
    expect(buildCollectionPolicy("production", "0.25").tracesSampleRate).toBe(0.25);
    expect(buildCollectionPolicy("production", "2").tracesSampleRate).toBe(0.1);
    expect(buildCollectionPolicy("local", undefined, "false")).toMatchObject({
      replayEnabled: false,
      replaySessionSampleRate: 0,
      replayOnErrorSampleRate: 0,
    });
    expect(buildCollectionPolicy("production", undefined, "true", "0.02", "0.5")).toMatchObject({
      replayEnabled: true,
      replaySessionSampleRate: 0.02,
      replayOnErrorSampleRate: 0.5,
    });
    expect(sanitizeUrl("/confirm?otp=000000#done")).toBe("/confirm");
  });
});
