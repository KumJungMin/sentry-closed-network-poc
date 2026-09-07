import { createFlowEvent, type FlowEventInput } from "@poc/flow-contract";
import * as Sentry from "@sentry/react";
import { recordFlowEvent } from "./flow-telemetry.js";
import { publishFlowFunnelSnapshot, type FlowFunnelSummary } from "./flow-snapshot.js";

export interface InternalAnalyticsOptions {
  endpoint?: string;
  summaryEndpoint?: string;
  fetcher?: typeof fetch;
}

export async function sendFlowAnalyticsEvent(
  input: FlowEventInput,
  options?: InternalAnalyticsOptions,
): Promise<void> {
  const endpoint = options?.endpoint ?? "/internal-api/analytics/events";
  const fetcher = options?.fetcher ?? fetch;
  const event = createFlowEvent(input);

  try {
    const response = await fetcher(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      keepalive: true,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    Sentry.logger.warn("internal_flow_analytics_failed", {
      service: event.service,
      "flow.name": event.flowName,
      "flow.step": event.step,
      "flow.event": event.event,
      "flow.attempt_id": event.attemptId,
    });
    throw error;
  }
}

export async function fetchFlowFunnelSummary(
  flowName: FlowEventInput["flowName"],
  options?: InternalAnalyticsOptions,
): Promise<FlowFunnelSummary> {
  const endpoint = options?.summaryEndpoint ?? "/internal-api/analytics/funnel";
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await (options?.fetcher ?? fetch)(
    `${endpoint}${separator}flowName=${encodeURIComponent(flowName)}`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error(`플로우 집계 조회가 HTTP ${response.status}로 실패했습니다.`);
  const payload: unknown = await response.json();
  if (
    !payload
    || typeof payload !== "object"
    || (payload as Record<string, unknown>).flowName !== flowName
    || !Array.isArray((payload as Record<string, unknown>).steps)
  ) {
    throw new Error("플로우 집계 응답 형식이 올바르지 않습니다.");
  }
  return payload as FlowFunnelSummary;
}

export function createObservedFlowEventSink(
  options?: InternalAnalyticsOptions,
): (input: FlowEventInput) => Promise<void> {
  return async (input) => {
    recordFlowEvent(input);
    await sendFlowAnalyticsEvent(input, options);
    if (!["step_viewed", "flow_cancelled", "flow_completed"].includes(input.event)) return;
    try {
      publishFlowFunnelSnapshot(await fetchFlowFunnelSummary(input.flowName, options));
    } catch (error) {
      Sentry.logger.warn("internal_flow_snapshot_failed", {
        "flow.name": input.flowName,
        "flow.step": input.step,
        "flow.attempt_id": input.attemptId,
      });
      throw error;
    }
  };
}
