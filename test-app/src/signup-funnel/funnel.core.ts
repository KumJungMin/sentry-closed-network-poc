export const signupSteps = [
  { id: "terms", label: "약관 동의", description: "필수 약관 확인 및 동의" },
  { id: "account", label: "계좌 인증", description: "합성 계좌 인증 결과 확인" },
  { id: "phone", label: "휴대폰 인증", description: "합성 휴대폰 인증 결과 확인" },
  { id: "cdd", label: "CDD", description: "고객확인 완료 상태 확인" },
] as const;

export type SignupStepId = (typeof signupSteps)[number]["id"];
export type FunnelEventName = "entered" | "advanced" | "abandoned" | "completed";

export interface FunnelSummaryStep {
  id: SignupStepId;
  label: string;
  reached: number;
  dropOff: number;
  dropOffRate: number;
  conversionRate: number;
}

export interface FunnelSummary {
  generatedAt: string;
  totalAttempts: number;
  completedAttempts: number;
  steps: FunnelSummaryStep[];
}

export function createAttemptId(randomUuid = crypto.randomUUID()): string {
  return `attempt_v1_${randomUuid}`;
}
