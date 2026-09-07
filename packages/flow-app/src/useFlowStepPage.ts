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
import type { FlowEventSink, FlowStepContent } from "./types.js";

interface UseFlowStepPageOptions {
  flowName: FlowName;
  stepId: FlowStepId;
  content: FlowStepContent;
  userId: string;
  onFlowEvent?: FlowEventSink;
}

export function useFlowStepPage(options: UseFlowStepPageOptions) {
  const { content, flowName, onFlowEvent, stepId, userId } = options;
  const definition = getFlowDefinition(flowName);
  const navigate = useNavigate();
  const storageKey = getFlowStorageKey(flowName);
  const currentIndex = definition.steps.findIndex(({ id }) => id === stepId);
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === definition.steps.length - 1;
  const [session, setSession] = useState<FlowSession>(() => loadOrCreateSession(storageKey));
  const [errorMessage, setErrorMessage] = useState<string>();
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
    emitEvent(onFlowEvent, {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      event: "step_submitted",
    });
    emitEvent(onFlowEvent, {
      attemptId: session.attemptId,
      userId,
      flowName,
      step: stepId,
      event: "step_succeeded",
    });
    const nextStep = definition.steps[currentIndex + 1];
    if (nextStep) navigate(nextStep.path);
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
    stepCount: definition.steps.length,
  };
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
