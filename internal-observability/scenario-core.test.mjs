import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFlowScenarioRequest, resolveFlowScenario } from "./scenario-core.mjs";

const baseInput = {
  flowName: "payment",
  attemptId: "attempt_v1_scenario-user-01",
};

test("허용 필드만으로 시나리오 요청을 정규화한다", () => {
  assert.deepEqual(normalizeFlowScenarioRequest({
    ...baseInput,
    scenarioCode: " decline ",
    accountNumber: "must-not-be-stored",
  }), {
    ...baseInput,
    scenarioCode: "DECLINE",
  });
});

test("DECLINE은 업무 거절 응답을 만든다", () => {
  assert.deepEqual(resolveFlowScenario({ ...baseInput, scenarioCode: "DECLINE" }), {
    statusCode: 422,
    body: {
      status: "business_decline",
      errorCode: "PAYMENT_DECLINED",
      message: "업무 정책에 따라 요청이 거절되었습니다.",
    },
  });
});

test("TIMEOUT은 기술 실패 응답을 만든다", () => {
  assert.deepEqual(resolveFlowScenario({ ...baseInput, scenarioCode: "TIMEOUT" }), {
    statusCode: 504,
    body: {
      status: "technical_error",
      errorCode: "PAYMENT_TIMEOUT",
      message: "내부 처리 시간이 초과되었습니다.",
    },
  });
});

test("임의의 입력은 성공 응답으로 처리한다", () => {
  assert.deepEqual(resolveFlowScenario({ ...baseInput, scenarioCode: "123456" }), {
    statusCode: 200,
    body: { status: "success" },
  });
});
