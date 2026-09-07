import { createFlowEvent, type FlowEvent, type FlowEventInput, type FlowName, type FlowStepId } from "@poc/flow-contract";
import * as Sentry from "@sentry/react";
import { setObservedUser } from "./client.js";

export interface CaptureFlowExceptionInput {
  attemptId: string;
  userId: string;
  flowName: FlowName;
  step: FlowStepId;
  errorCode: string;
  error: unknown;
}

export function recordFlowEvent(input: FlowEventInput): FlowEvent {
  const event = createFlowEvent(input);
  if (event.userId !== undefined) setObservedUser(event.userId);
  const attributes = toLogAttributes(event);

  Sentry.addBreadcrumb({
    category: `${event.flowName}.flow`,
    message: event.event,
    level: event.event === "step_failed" ? "error" : "info",
    data: attributes,
  });

  if (event.event === "step_failed" && event.outcome === "technical_error") {
    Sentry.logger.error("frontend_flow_step_failed", attributes);
  } else if (event.event === "step_failed" || event.event === "step_validation_failed") {
    Sentry.logger.warn("frontend_flow_step_blocked", attributes);
  } else {
    Sentry.logger.info("frontend_flow_event", attributes);
  }

  return event;
}

export function captureFlowException(input: CaptureFlowExceptionInput): string {
  const event = recordFlowEvent({
    attemptId: input.attemptId,
    userId: input.userId,
    flowName: input.flowName,
    step: input.step,
    event: "step_failed",
    outcome: "technical_error",
    errorCode: input.errorCode,
  });
  const error = input.error instanceof Error
    ? input.error
    : new Error("알 수 없는 프론트엔드 플로우 오류");

  return Sentry.withScope((scope) => {
    scope.setUser({ id: input.userId });
    scope.setTags({
      service: event.service,
      "flow.slug": event.flowName,
      "flow.step": event.step,
      "flow.attempt_id": event.attemptId,
      error_code: input.errorCode,
    });
    scope.setContext("flow", {
      version: event.flowVersion,
      page_path: event.pagePath,
      outcome: event.outcome,
    });
    return Sentry.captureException(error);
  });
}

export function createSentryFlowEventSink(): (input: FlowEventInput) => void {
  return (input) => {
    recordFlowEvent(input);
  };
}

function toLogAttributes(event: FlowEvent): Record<string, string | number> {
  return {
    service: event.service,
    "flow.slug": event.flowName,
    "flow.version": event.flowVersion,
    "flow.step": event.step,
    "flow.event": event.event,
    "flow.attempt_id": event.attemptId,
    "page.path": event.pagePath,
    ...(event.outcome === undefined ? {} : { "flow.outcome": event.outcome }),
    ...(event.errorCode === undefined ? {} : { error_code: event.errorCode }),
  };
}
