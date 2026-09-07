import type { FlowName } from "@poc/flow-contract";
import type { FlowStepField } from "./types.js";

export interface FlowSession {
  attemptId: string;
  values: Readonly<Record<string, string | boolean>>;
}

export function createAttemptId(randomId: string): string {
  const normalizedRandomId = randomId.toLowerCase().replace(/[^a-z0-9-]/gu, "").slice(0, 64);
  if (normalizedRandomId.length < 12) throw new Error("시도 ID를 만들기 위한 난수 길이가 부족합니다.");
  return `attempt_v1_${normalizedRandomId}`;
}

export function getFlowStorageKey(flowName: FlowName): string {
  return `poc:flow-session:v1:${flowName}`;
}

export function parseFlowSession(value: string | null): FlowSession | undefined {
  if (!value) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return undefined;
    const { attemptId, values } = parsed as Record<string, unknown>;
    if (typeof attemptId !== "string" || !/^attempt_v1_[a-z0-9-]{12,64}$/u.test(attemptId)) {
      return undefined;
    }
    if (!values || typeof values !== "object" || Array.isArray(values)) return undefined;
    const safeValues = Object.fromEntries(
      Object.entries(values).filter(([, item]) => typeof item === "string" || typeof item === "boolean"),
    );
    if (Object.keys(safeValues).length !== Object.keys(values).length) return undefined;
    return { attemptId, values: safeValues };
  } catch {
    return undefined;
  }
}

export function validateStepValue(
  field: FlowStepField | undefined,
  value: string | boolean | undefined,
): string | undefined {
  if (!field || !field.required) return undefined;
  if (field.type === "checkbox") {
    return value === true ? undefined : `${field.label} 항목을 확인해 주세요.`;
  }
  if (typeof value !== "string" || value.trim() === "") return `${field.label} 항목을 입력해 주세요.`;
  if (field.type === "number" && (!Number.isFinite(Number(value)) || Number(value) <= 0)) {
    return `${field.label} 항목에는 0보다 큰 값을 입력해 주세요.`;
  }
  return undefined;
}
