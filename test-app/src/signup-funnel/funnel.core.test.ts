import { describe, expect, it } from "vitest";
import { createAttemptId, signupSteps } from "./funnel.core";

describe("가입 퍼널 모델", () => {
  it("업무 순서를 고정하고 원본 사용자 정보 없는 가입 시도 ID를 만든다", () => {
    expect(signupSteps.map(({ id }) => id)).toEqual(["terms", "account", "phone", "cdd"]);
    expect(createAttemptId("12345678-1234-1234-1234-123456789abc"))
      .toBe("attempt_v1_12345678-1234-1234-1234-123456789abc");
  });
});
