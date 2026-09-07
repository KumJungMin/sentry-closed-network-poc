import { getFlowDefinition, type FlowName, type FlowStepId } from "@poc/flow-contract";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  createAttemptId,
  getFlowStorageKey,
  parseFlowSession,
  validateStepValue,
  type FlowSession,
} from "./flow-session.core.js";
import type {
  FlowEventSink,
  FlowExceptionContext,
  FlowStepContent,
  FlowStepSubmitContext,
  FlowStepSubmitResult,
} from "./types.js";

interface UseFlowStepPageOptions {
  flowName: FlowName;
  stepId: FlowStepId;
  content: FlowStepContent;
  userId: string;
  onFlowEvent?: FlowEventSink;
  onFlowException?: (context: FlowExceptionContext) => void;
  submitStep?: (context: FlowStepSubmitContext) => Promise<FlowStepSubmitResult>;
}

export function useFlowStepPage(options: UseFlowStepPageOptions) {
  const {
    content,
    flowName,
    onFlowEvent,
    onFlowException,
    stepId,
    submitStep,
    userId,
  } = options;
  const definition = getFlowDefinition(flowName);
  const navigate = useNavigate();
  const storageKey = getFlowStorageKey(flowName);
  const currentIndex = definition.steps.findIndex(({ id }) => id === stepId);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === definition.steps.length - 1;
  const [session, setSession] = useState<FlowSession>(() => loadOrCreateSession(storageKey));
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fieldName = content.field?.name;
  const fieldValue = fieldName === undefined
    ? ""
    : (session.values[fieldName] ?? (content.field?.type === "checkbox" ? false : ""));
  const recordedPageRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const pageKey = `${session.attemptId}:${stepId}`;
    if (recordedPageRef.current === pageKey) return;
    recordedPageRef.current = pageKey;
    if (isFirstStep) emitEvent(onFlowEvent, {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      event: "flow_started",
    });
    emitEvent(onFlowEvent, {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      event: "step_viewed",
    });
    if (isLastStep) emitEvent(onFlowEvent, {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      event: "flow_completed",
    });
  }, [flowName, isFirstStep, isLastStep, onFlowEvent, session.attemptId, stepId, userId]);

  function replaceSession(nextSession: FlowSession): void {
    window.sessionStorage.setItem(storageKey, JSON.stringify(nextSession));
    setSession(nextSession);
    setErrorMessage(undefined);
  }

  function handleFieldChange(value: string | boolean): void {
    if (!fieldName) return;
    replaceSession({
      ...session,
      values: { ...session.values, [fieldName]: value },
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    void submitCurrentStep();
  }

  async function submitCurrentStep(): Promise<void> {
    const validationMessage = validateStepValue(content.field, fieldValue);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      emitEvent(onFlowEvent, {
        attemptId: session.attemptId,
        userId,
        flowName,
        step: stepId,
        event: "step_validation_failed",
      });
      return;
    }
    setErrorMessage(undefined);
    setIsSubmitting(true);
    emitEvent(onFlowEvent, {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      event: "step_submitted",
    });

    const context = {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      values: session.values,
    } satisfies FlowStepSubmitContext;

    try {
      const result = submitStep ? await submitStep(context) : { status: "success" as const };
      if (result.status === "business_decline") {
        setErrorMessage(result.message);
        emitEvent(onFlowEvent, {
          attemptId: session.attemptId,
          userId,
          flowName,
          step: stepId,
          event: "step_failed",
          outcome: "business_decline",
          errorCode: result.errorCode,
        });
        return;
      }
      emitEvent(onFlowEvent, {
        attemptId: session.attemptId,
        userId,
        flowName,
        step: stepId,
        event: "step_succeeded",
      });
      const nextStep = definition.steps[currentIndex + 1];
      if (nextStep) navigate(nextStep.path);
    } catch (error) {
      const errorCode = getErrorCode(error);
      setErrorMessage("일시적인 시스템 오류가 발생했습니다. 다시 시도해 주세요.");
      if (onFlowException) onFlowException({ ...context, errorCode, error });
      else emitEvent(onFlowEvent, {
        attemptId: session.attemptId,
        userId,
        flowName,
        step: stepId,
        event: "step_failed",
        outcome: "technical_error",
        errorCode,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleBack(): void {
    const previousStep = definition.steps[currentIndex - 1];
    if (previousStep) navigate(previousStep.path);
  }

  function handleRestart(): void {
    replaceSession(createEmptySession());
    navigate(definition.steps[0].path);
  }

  function handleCancel(): void {
    emitEvent(onFlowEvent, {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      event: "flow_cancelled",
    });
    handleRestart();
  }

  return {
    attemptId: session.attemptId,
    currentIndex,
    errorMessage,
    fieldValue,
    handleBack,
    handleCancel,
    handleFieldChange,
    handleRestart,
    handleSubmit,
    isFirstStep,
    isLastStep,
    isSubmitting,
    stepCount: definition.steps.length,
  };
}

function getErrorCode(error: unknown): string {
  if (
    error
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    && /^[A-Z0-9_:-]{1,64}$/u.test(error.code)
  ) {
    return error.code;
  }
  return "FLOW_SUBMISSION_FAILED";
}

function createEmptySession(): FlowSession {
  return {
    attemptId: createAttemptId(crypto.randomUUID()),
    values: {},
  };
}

function loadOrCreateSession(storageKey: string): FlowSession {
  const existing = parseFlowSession(window.sessionStorage.getItem(storageKey));
  if (existing) return existing;
  const created = createEmptySession();
  window.sessionStorage.setItem(storageKey, JSON.stringify(created));
  return created;
}

function emitEvent(onFlowEvent: FlowEventSink | undefined, event: Parameters<FlowEventSink>[0]): void {
  try {
    const result = onFlowEvent?.(event);
    if (result instanceof Promise) void result.catch(() => undefined);
  } catch {
    // 관측 실패가 사용자 플로우를 중단시키지 않도록 격리한다.
  }
}
