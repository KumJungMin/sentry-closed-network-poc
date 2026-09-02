export type TestActionId =
  | "unhandled-error"
  | "captured-exception"
  | "business-message"
  | "failed-api"
  | "breadcrumb-error"
  | "tag-context-error"
  | "slow-operation";

export type ResultTone = "sent" | "scheduled" | "expected-error" | "failed";

export interface ActionResult {
  tone: ResultTone;
  summary: string;
  detail: string;
}

export interface TestActionDefinition {
  id: TestActionId;
  index: number;
  title: string;
  sentryFeature: string;
  description: string;
  expectedResult: string;
  run: () => Promise<ActionResult>;
}

export interface ExecutionEntry extends ActionResult {
  id: string;
  actionTitle: string;
  occurredAt: string;
}
