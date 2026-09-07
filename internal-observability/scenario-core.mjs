const flowNames = new Set(["membership", "remittance", "payment"]);
const attemptIdPattern = /^attempt_v1_[a-z0-9-]{12,64}$/;

export function normalizeFlowScenarioRequest(input) {
  if (!input || typeof input !== "object") throw new Error("JSON 객체가 필요합니다.");
  if (!flowNames.has(input.flowName)) throw new Error("유효하지 않은 도메인 플로우입니다.");
  if (!attemptIdPattern.test(input.attemptId ?? "")) throw new Error("유효하지 않은 플로우 시도 ID입니다.");
  if (typeof input.scenarioCode !== "string" || input.scenarioCode.length > 32) {
    throw new Error("유효하지 않은 테스트 시나리오 코드입니다.");
  }
  return {
    flowName: input.flowName,
    attemptId: input.attemptId,
    scenarioCode: input.scenarioCode.trim().toUpperCase() || "OK",
  };
}

export function resolveFlowScenario(input) {
  const request = normalizeFlowScenarioRequest(input);
  const errorPrefix = request.flowName.toUpperCase();
  if (request.scenarioCode === "DECLINE") {
    return {
      statusCode: 422,
      body: {
        status: "business_decline",
        errorCode: `${errorPrefix}_DECLINED`,
        message: "업무 정책에 따라 요청이 거절되었습니다.",
      },
    };
  }
  if (request.scenarioCode === "TIMEOUT") {
    return {
      statusCode: 504,
      body: {
        status: "technical_error",
        errorCode: `${errorPrefix}_TIMEOUT`,
        message: "내부 처리 시간이 초과되었습니다.",
      },
    };
  }
  return {
    statusCode: 200,
    body: { status: "success" },
  };
}
