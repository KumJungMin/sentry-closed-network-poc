import { describe, expect, it } from "vitest";
import {
  createAttemptId,
  formatDropOffGracePeriod,
  getNextSignupStep,
  getSignupStepIndex,
  isSignupStepId,
  signupSteps,
} from "./funnel.core";

describe("가입 퍼널 모델", () => {
  it("업무 순서를 고정하고 원본 사용자 정보 없는 가입 시도 ID를 만든다", () => {
    expect(signupSteps.map(({ id }) => id)).toEqual(["terms", "account", "phone", "cdd"]);
    expect(createAttemptId("12345678-1234-1234-1234-123456789abc"))
      .toBe("attempt_v1_12345678-1234-1234-1234-123456789abc");
  });
});

it("이탈 확정 유예시간을 사용자 문구로 변환한다", () => {
  expect(formatDropOffGracePeriod(0)).toBe("즉시");
  expect(formatDropOffGracePeriod(30 * 60 * 1000)).toBe("30분 후");
});

it("가입 단계 식별과 다음 단계를 순서대로 제공한다", () => {
  expect(isSignupStepId("account")).toBe(true);
  expect(isSignupStepId("unknown")).toBe(false);
  expect(getNextSignupStep("terms")?.id).toBe("account");
  expect(getNextSignupStep("cdd")).toBeNull();
  expect(getSignupStepIndex("phone")).toBe(2);
});
