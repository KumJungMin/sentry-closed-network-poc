import type { ErrorEvent } from "@sentry/react";
import { sanitizeSentryEvent } from "../src/security/securityPolicy.core.ts";
import { buildFakeSensitivePayload } from "../src/security/securityTest.core.ts";

const [eventId, timestamp] = process.argv.slice(2);

if (!eventId || !timestamp) {
  throw new Error("event id와 timestamp가 필요합니다.");
}

const payload = buildFakeSensitivePayload();
const rawEvent: ErrorEvent = {
  type: undefined,
  event_id: eventId,
  timestamp: Date.parse(timestamp) / 1000,
  platform: "javascript",
  level: "error",
  environment: "local",
  release: "frontend-poc@0.1.0",
  logger: "phase7.client-scrub-verification",
  exception: {
    values: [{ type: "Phase7PrivacyVerification", value: "[PoC] Phase 7 privacy scrub verification" }],
  },
  tags: payload.tags,
  user: payload.user,
  request: {
    method: "POST",
    url: "http://127.0.0.1:5173/payment?email=phase7.person@example.invalid",
    headers: {
      Authorization: "Bearer FAKE-AUTHORIZATION-PHASE7",
      Cookie: "session=FAKE-COOKIE-PHASE7",
    },
    data: "FAKE-RAW-REQUEST-PHASE7",
    query_string: "email=phase7.person@example.invalid",
  },
  contexts: { phase7_sensitive_input: payload.context },
  breadcrumbs: [payload.breadcrumb],
  extra: {
    raw_response: "FAKE-RAW-RESPONSE-PHASE7",
    safe_verification_mode: "client-before-send",
  },
};

process.stdout.write(JSON.stringify(sanitizeSentryEvent(rawEvent)));
