import type { FlowStepId } from "@poc/flow-contract";
import type { FlowStepSubmitContext, FlowStepSubmitResult } from "./types.js";

export interface MockFlowSubmitterOptions {
  targetStep: FlowStepId;
  scenarioField: string;
  endpoint?: string;
  fetcher?: typeof fetch;
}

export class FlowTechnicalError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "FlowTechnicalError";
    this.code = code;
  }
}

export function createMockFlowSubmitter(
  options: MockFlowSubmitterOptions,
): (context: FlowStepSubmitContext) => Promise<FlowStepSubmitResult> {
  return async (context) => {
    if (context.step !== options.targetStep) return { status: "success" };
    const scenarioValue = context.values[options.scenarioField];
    const scenarioCode = typeof scenarioValue === "string" ? scenarioValue : "OK";
    const response = await (options.fetcher ?? fetch)(
      options.endpoint ?? "/internal-api/simulations/flow-submit",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flowName: context.flowName,
          attemptId: context.attemptId,
          scenarioCode,
        }),
      },
    );
    const payload = await parseResponse(response);
    if (response.ok && payload.status === "success") return { status: "success" };
    if (
      response.status === 422
      && payload.status === "business_decline"
      && typeof payload.errorCode === "string"
      && typeof payload.message === "string"
    ) {
      return {
        status: "business_decline",
        errorCode: payload.errorCode,
        message: payload.message,
      };
    }

    const fallbackCode = `${context.flowName.toUpperCase()}_SUBMISSION_FAILED`;
    throw new FlowTechnicalError(
      typeof payload.errorCode === "string" ? payload.errorCode : fallbackCode,
      `플로우 제출 API가 HTTP ${response.status}로 실패했습니다.`,
    );
  };
}

async function parseResponse(response: Response): Promise<Record<string, unknown>> {
  try {
    const payload: unknown = await response.json();
    return payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
