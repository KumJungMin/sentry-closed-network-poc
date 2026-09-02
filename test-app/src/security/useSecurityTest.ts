import * as Sentry from "@sentry/react";
import { useState } from "react";
import { buildFakeSensitivePayload } from "./securityTest.core";

export interface SecurityTestResult {
  tone: "sent" | "failed";
  summary: string;
  detail: string;
}

export function useSecurityTest(isSentryEnabled: boolean) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SecurityTestResult | null>(null);

  const submit = async () => {
    if (!isSentryEnabled) return;
    setIsSubmitting(true);
    setResult(null);

    try {
      const payload = buildFakeSensitivePayload();
      let eventId = "";

      Sentry.withScope((scope) => {
        scope.setTags(payload.tags);
        scope.setUser(payload.user);
        scope.setContext("phase7_sensitive_input", payload.context);
        scope.addBreadcrumb(payload.breadcrumb);
        eventId = Sentry.captureException(new Error("[PoC] Phase 7 privacy scrub verification"));
      });

      const flushed = await Sentry.flush(3000);
      setResult({
        tone: flushed ? "sent" : "failed",
        summary: flushed
          ? "합성 민감정보 이벤트를 보안 필터를 거쳐 전송했습니다."
          : "제한 시간 안에 Sentry 전송 완료를 확인하지 못했습니다.",
        detail: `event id: ${eventId} · ${flushed ? "로컬 전송 큐 완료" : "전송 큐 재확인 필요"}`,
      });
    } catch (cause) {
      setResult({
        tone: "failed",
        summary: "보안 검증 이벤트 전송 중 오류가 발생했습니다.",
        detail: cause instanceof Error ? cause.message : "알 수 없는 Sentry 전송 오류",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { isSubmitting, result, submit };
}
