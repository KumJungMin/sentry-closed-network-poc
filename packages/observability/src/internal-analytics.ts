import { createFlowEvent, type FlowEventInput } from "@poc/flow-contract";
import * as Sentry from "@sentry/react";
import { recordFlowEvent } from "./flow-telemetry.js";

export interface InternalAnalyticsOptions {
  endpoint?: string;
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

export function createObservedFlowEventSink(
  options?: InternalAnalyticsOptions,
): (input: FlowEventInput) => Promise<void> {
  return async (input) => {
    recordFlowEvent(input);
    await sendFlowAnalyticsEvent(input, options);
  };
}
