export type FlowName = "membership" | "remittance" | "payment";

export type FlowStepId =
  | "terms"
  | "account"
  | "phone"
  | "identity"
  | "recipient"
  | "amount"
  | "order"
  | "method"
  | "review"
  | "authenticate"
  | "result";

export interface FlowStep {
  id: FlowStepId;
  label: string;
  path: string;
}

export interface FlowDefinition {
  name: FlowName;
  service: `frontend-${FlowName}`;
  version: number;
  dropOffGracePeriodMs: number;
  steps: readonly FlowStep[];
}

function defineFlow(definition: FlowDefinition): FlowDefinition {
  return Object.freeze({
    ...definition,
    steps: Object.freeze(definition.steps),
  });
}

export const FLOW_DEFINITIONS: Readonly<Record<FlowName, FlowDefinition>> = {
  membership: defineFlow({
    name: "membership",
    service: "frontend-membership",
    version: 1,
    dropOffGracePeriodMs: 30 * 60 * 1_000,
    steps: [
      { id: "terms", label: "약관 동의", path: "/signup/terms" },
      { id: "account", label: "계정 정보", path: "/signup/account" },
      { id: "phone", label: "휴대폰 인증", path: "/signup/phone" },
      { id: "identity", label: "본인 확인", path: "/signup/identity" },
      { id: "result", label: "가입 완료", path: "/signup/complete" },
    ],
  }),
  remittance: defineFlow({
    name: "remittance",
    service: "frontend-remittance",
    version: 1,
    dropOffGracePeriodMs: 15 * 60 * 1_000,
    steps: [
      { id: "recipient", label: "수취인", path: "/remittance/recipient" },
      { id: "amount", label: "송금 금액", path: "/remittance/amount" },
      { id: "review", label: "송금 확인", path: "/remittance/review" },
      { id: "authenticate", label: "송금 인증", path: "/remittance/authenticate" },
      { id: "result", label: "송금 결과", path: "/remittance/result" },
    ],
  }),
  payment: defineFlow({
    name: "payment",
    service: "frontend-payment",
    version: 1,
    dropOffGracePeriodMs: 5 * 60 * 1_000,
    steps: [
      { id: "order", label: "주문 확인", path: "/payment/order" },
      { id: "method", label: "결제 수단", path: "/payment/method" },
      { id: "review", label: "결제 확인", path: "/payment/review" },
      { id: "authenticate", label: "결제 인증", path: "/payment/authenticate" },
      { id: "result", label: "결제 결과", path: "/payment/result" },
    ],
  }),
};

export function getFlowDefinition(flowName: FlowName): FlowDefinition {
  return FLOW_DEFINITIONS[flowName];
}

export function getFlowStep(flowName: FlowName, stepId: string): FlowStep | undefined {
  return getFlowDefinition(flowName).steps.find(({ id }) => id === stepId);
}

export function getNextFlowStep(flowName: FlowName, stepId: FlowStepId): FlowStep | undefined {
  const steps = getFlowDefinition(flowName).steps;
  const currentIndex = steps.findIndex(({ id }) => id === stepId);
  return currentIndex < 0 ? undefined : steps[currentIndex + 1];
}

export function isFlowStepId(flowName: FlowName, stepId: string): stepId is FlowStepId {
  return getFlowStep(flowName, stepId) !== undefined;
}

export function isTerminalFlowStep(flowName: FlowName, stepId: FlowStepId): boolean {
  const steps = getFlowDefinition(flowName).steps;
  return steps.at(-1)?.id === stepId;
}
