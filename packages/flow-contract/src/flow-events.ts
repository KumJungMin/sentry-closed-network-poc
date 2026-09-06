import {
  getFlowDefinition,
  getFlowStep,
  isTerminalFlowStep,
  type FlowName,
  type FlowStepId,
} from "./flow-definitions.js";

export const FLOW_EVENT_NAMES = [
  "flow_started",
  "step_viewed",
  "step_validation_failed",
  "step_submitted",
  "step_succeeded",
  "step_failed",
  "flow_cancelled",
  "flow_completed",
] as const;

export type FlowEventName = (typeof FLOW_EVENT_NAMES)[number];
export type FlowOutcome =
  | "success"
  | "validation_error"
  | "business_decline"
  | "technical_error"
  | "cancelled";
export type FlowState =
  | "idle"
  | "viewed"
  | "submitting"
  | "succeeded"
  | "recoverable_error"
  | "fatal_error"
  | "cancelled"
  | "completed";

export interface FlowEventInput {
  attemptId: string;
  userId?: string;
  flowName: FlowName;
  step: FlowStepId;
  event: FlowEventName;
  outcome?: FlowOutcome;
  errorCode?: string;
}

export interface FlowEvent extends FlowEventInput {
  schemaVersion: 1;
  flowVersion: number;
  pagePath: string;
  service: `frontend-${FlowName}`;
  occurredAt: string;
}

const attemptIdPattern = /^attempt_v1_[a-z0-9-]{12,64}$/;
const errorCodePattern = /^[A-Z0-9_:-]{1,64}$/;

function resolveOutcome(input: FlowEventInput): FlowOutcome | undefined {
  if (input.event === "step_validation_failed") return "validation_error";
  if (input.event === "flow_cancelled") return "cancelled";
  if (input.event === "step_succeeded" || input.event === "flow_completed") return "success";
  return input.outcome;
}

export function createFlowEvent(input: FlowEventInput, now = new Date()): FlowEvent {
  const definition = getFlowDefinition(input.flowName);
  const step = getFlowStep(input.flowName, input.step);
  if (!attemptIdPattern.test(input.attemptId)) {
    throw new Error("유효하지 않은 플로우 시도 ID입니다.");
  }
  if (!step) throw new Error("현재 플로우에 속하지 않은 단계입니다.");
  if (input.userId !== undefined && (input.userId.length === 0 || input.userId.length > 128)) {
    throw new Error("user.id는 1자 이상 128자 이하여야 합니다.");
  }
  if (input.errorCode !== undefined && !errorCodePattern.test(input.errorCode)) {
    throw new Error("errorCode는 대문자 영문, 숫자, _, :, -만 사용할 수 있습니다.");
  }
  if (input.event === "flow_started" && definition.steps[0]?.id !== input.step) {
    throw new Error("플로우 시작 이벤트는 첫 단계에서만 기록할 수 있습니다.");
  }
  if (input.event === "flow_completed" && !isTerminalFlowStep(input.flowName, input.step)) {
    throw new Error("플로우 완료 이벤트는 마지막 단계에서만 기록할 수 있습니다.");
  }
  if (
    input.event === "step_failed"
    && input.outcome !== "business_decline"
    && input.outcome !== "technical_error"
  ) {
    throw new Error("단계 실패에는 business_decline 또는 technical_error 결과가 필요합니다.");
  }

  const occurredAt = now.toISOString();
  const outcome = resolveOutcome(input);
  return {
    schemaVersion: 1,
    attemptId: input.attemptId,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    flowName: input.flowName,
    flowVersion: definition.version,
    step: input.step,
    event: input.event,
    ...(outcome === undefined ? {} : { outcome }),
    ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
    pagePath: step.path,
    service: definition.service,
    occurredAt,
  };
}

export function reduceFlowState(current: FlowState, event: FlowEvent): FlowState {
  switch (event.event) {
    case "flow_started":
    case "step_viewed":
      return "viewed";
    case "step_validation_failed":
      return "recoverable_error";
    case "step_submitted":
      return "submitting";
    case "step_succeeded":
      return "succeeded";
    case "step_failed":
      return event.outcome === "business_decline" ? "recoverable_error" : "fatal_error";
    case "flow_cancelled":
      return "cancelled";
    case "flow_completed":
      return "completed";
    default:
      return current;
  }
}
