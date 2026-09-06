export const signupSteps = [
  { id: "terms", label: "약관 동의", description: "필수 약관 확인 및 동의" },
  { id: "account", label: "계좌 인증", description: "합성 계좌 인증 결과 확인" },
  { id: "phone", label: "휴대폰 인증", description: "합성 휴대폰 인증 결과 확인" },
  { id: "cdd", label: "CDD", description: "고객확인 완료 상태 확인" },
] as const;

export type SignupStepId = (typeof signupSteps)[number]["id"];
export type FunnelEventName =
  | "page_view"
  | "entered"
  | "advanced"
  | "abandoned"
  | "completed";

export interface FunnelSummaryStep {
  id: SignupStepId;
  label: string;
  reached: number;
  dropOff: number;
  pendingDropOff: number;
  dropOffRate: number;
  conversionRate: number;
}

export interface FunnelSummary {
  generatedAt: string;
  dropOffGracePeriodMs: number;
  totalAttempts: number;
  completedAttempts: number;
  steps: FunnelSummaryStep[];
}

const signupStepIds = new Set<string>(signupSteps.map(({ id }) => id));

export function isSignupStepId(value: unknown): value is SignupStepId {
  return typeof value === "string" && signupStepIds.has(value);
}

export function getNextSignupStep(stepId: SignupStepId) {
  const currentIndex = signupSteps.findIndex(({ id }) => id === stepId);
  return signupSteps[currentIndex + 1] ?? null;
}

export function getSignupStepIndex(stepId: SignupStepId): number {
  return signupSteps.findIndex(({ id }) => id === stepId);
}

export function formatDropOffGracePeriod(milliseconds: number): string {
  if (milliseconds <= 0) return "즉시";
  return `${Math.ceil(milliseconds / 60_000)}분 후`;
}

export function createAttemptId(randomUuid = crypto.randomUUID()): string {
  return `attempt_v1_${randomUuid}`;
}
