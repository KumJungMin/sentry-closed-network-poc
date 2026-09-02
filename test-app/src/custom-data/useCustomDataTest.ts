import * as Sentry from "@sentry/react";
import { useState } from "react";
import {
  buildCustomDataPayload,
  defaultCustomDataFormState,
  validateCustomDataInput,
  type CustomDataFormState,
} from "./customData.core";

export interface CustomDataSubmissionResult {
  tone: "sent" | "failed";
  summary: string;
  detail: string;
}

export function useCustomDataTest(isSentryEnabled: boolean) {
  const [form, setForm] = useState<CustomDataFormState>(defaultCustomDataFormState);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<CustomDataSubmissionResult | null>(null);

  const updateField = <Key extends keyof CustomDataFormState>(
    field: Key,
    value: CustomDataFormState[Key],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors([]);
    setResult(null);
  };

  const submit = async () => {
    const validationErrors = validateCustomDataInput(form);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setResult(null);
      return;
    }

    if (!isSentryEnabled) {
      setErrors(["Sentry DSN을 설정한 뒤 커스텀 이벤트를 전송할 수 있습니다."]);
      setResult(null);
      return;
    }

    setErrors([]);
    setIsSubmitting(true);
    setResult(null);

    try {
      const payload = buildCustomDataPayload(form);
      let eventId = "";

      Sentry.withScope((scope) => {
        scope.setTags(payload.tags);
        scope.setContext("financial_webview_state", payload.context);
        payload.breadcrumbs.forEach((breadcrumb) => scope.addBreadcrumb(breadcrumb));
        eventId = Sentry.captureException(new Error("[PoC] Financial WebView business error"));
      });

      const flushed = await Sentry.flush(2000);
      setResult({
        tone: "sent",
        summary: "금융 WebView 커스텀 이벤트를 전송했습니다.",
        detail: `event id: ${eventId} · ${flushed ? "로컬 전송 큐 완료" : "전송 큐 확인 필요"}`,
      });
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "알 수 없는 Sentry 전송 오류";
      setResult({
        tone: "failed",
        summary: "커스텀 이벤트 전송 중 오류가 발생했습니다.",
        detail,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    errors,
    isSubmitting,
    result,
    updateField,
    submit,
  };
}
