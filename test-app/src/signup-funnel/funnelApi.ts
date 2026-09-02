import * as Sentry from "@sentry/react";
import type { FunnelEventName, FunnelSummary, SignupStepId } from "./funnel.core";

export async function recordFunnelEvent(
  attemptId: string,
  step: SignupStepId,
  event: FunnelEventName,
): Promise<void> {
  Sentry.addBreadcrumb({
    category: "signup.funnel",
    level: "info",
    message: `${step}.${event}`,
    data: { step, event, attempt_id: attemptId },
  });

  await Sentry.startSpan(
    {
      name: `signup.${step}.${event}`,
      op: "ui.funnel",
      attributes: {
        "funnel.name": "signup",
        "funnel.step": step,
        "funnel.event": event,
        "signup.attempt_id": attemptId,
        service: "membership",
      },
    },
    async () => {
      const response = await fetch("/internal-api/analytics/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, step, event }),
      });
      if (!response.ok) throw new Error("가입 퍼널 이벤트 저장에 실패했습니다.");
    },
  );
}

export async function fetchFunnelSummary(): Promise<FunnelSummary> {
  const response = await fetch("/internal-api/analytics/funnel", { cache: "no-store" });
  if (!response.ok) throw new Error("가입 퍼널 집계를 불러오지 못했습니다.");
  return response.json() as Promise<FunnelSummary>;
}
