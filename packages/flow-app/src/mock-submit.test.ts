import { describe, expect, it, vi } from "vitest";
import { FlowTechnicalError, createMockFlowSubmitter } from "./mock-submit.js";

const baseContext = {
  attemptId: "attempt_v1_payment-submit-01",
  userId: "CUSTOMER-001",
  flowName: "payment",
  step: "authenticate",
  values: { authCode: "OK", cardNumber: "must-not-be-sent" },
} as const;

describe("플로우 Mock 제출", () => {
  it("대상 단계가 아니면 API를 호출하지 않는다", async () => {
    const fetcher = vi.fn();
    const submit = createMockFlowSubmitter({ targetStep: "authenticate", scenarioField: "authCode", fetcher });

    await expect(submit({ ...baseContext, step: "review" })).resolves.toEqual({ status: "success" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("업무 거절 응답을 화면 결과로 변환한다", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "business_decline",
      errorCode: "PAYMENT_DECLINED",
      message: "업무 정책에 따라 요청이 거절되었습니다.",
    }), { status: 422 }));
    const submit = createMockFlowSubmitter({ targetStep: "authenticate", scenarioField: "authCode", fetcher });

    await expect(submit({ ...baseContext, values: { authCode: "DECLINE" } })).resolves.toEqual({
      status: "business_decline",
      errorCode: "PAYMENT_DECLINED",
      message: "업무 정책에 따라 요청이 거절되었습니다.",
    });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      flowName: "payment",
      attemptId: baseContext.attemptId,
      scenarioCode: "DECLINE",
    });
  });

  it("기술 실패 응답은 오류 코드가 있는 원본 Error를 던진다", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "technical_error",
      errorCode: "PAYMENT_TIMEOUT",
    }), { status: 504 }));
    const submit = createMockFlowSubmitter({ targetStep: "authenticate", scenarioField: "authCode", fetcher });

    await expect(submit({ ...baseContext, values: { authCode: "TIMEOUT" } })).rejects.toEqual(
      expect.objectContaining<Partial<FlowTechnicalError>>({
        name: "FlowTechnicalError",
        code: "PAYMENT_TIMEOUT",
      }),
    );
  });
});
