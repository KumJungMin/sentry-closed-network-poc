import { describe, expect, it } from "vitest";
import {
  createAttemptId,
  getFlowStorageKey,
  parseFlowSession,
  validateStepValue,
} from "./flow-session.core.js";

describe("플로우 브라우저 세션", () => {
  it("공통 규격의 attempt ID와 도메인별 저장 키를 만든다", () => {
    expect(createAttemptId("123E4567-E89B-12D3-A456-426614174000"))
      .toBe("attempt_v1_123e4567-e89b-12d3-a456-426614174000");
    expect(getFlowStorageKey("payment")).toBe("poc:flow-session:v1:payment");
  });

  it("손상되거나 허용하지 않은 값을 포함한 세션을 무시한다", () => {
    expect(parseFlowSession("not-json")).toBeUndefined();
    expect(parseFlowSession(JSON.stringify({
      attemptId: "attempt_v1_123456789abc",
      values: { safe: "yes", unsafe: { account: "secret" } },
    }))).toBeUndefined();
  });

  it("허용된 문자열과 불리언 값만 복원한다", () => {
    expect(parseFlowSession(JSON.stringify({
      attemptId: "attempt_v1_123456789abc",
      values: { terms: true, phone: "01000000000" },
    }))).toEqual({
      attemptId: "attempt_v1_123456789abc",
      values: { terms: true, phone: "01000000000" },
    });
  });

  it("필수 입력과 양수 금액을 검증한다", () => {
    expect(validateStepValue({ name: "terms", label: "약관", type: "checkbox", required: true }, false))
      .toBe("약관 항목을 확인해 주세요.");
    expect(validateStepValue({ name: "amount", label: "금액", type: "number", required: true }, "0"))
      .toBe("금액 항목에는 0보다 큰 값을 입력해 주세요.");
    expect(validateStepValue({ name: "amount", label: "금액", type: "number", required: true }, "1000"))
      .toBeUndefined();
  });
});
