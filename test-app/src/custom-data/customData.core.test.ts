import { describe, expect, it } from "vitest";
import {
  buildCustomDataPayload,
  defaultCustomDataFormState,
  validateCustomDataInput,
} from "./customData.core";

describe("Phase 5 사용자 지정 데이터 매핑", () => {
  it("검색과 집계가 필요한 값만 Tag로 만든다", () => {
    const payload = buildCustomDataPayload({
      ...defaultCustomDataFormState,
      channel: "panda",
      service: "payment",
      currency: "USD",
      errorCode: "PAYMENT_AUTH_FAILED",
      page: "payment-confirm",
      processStep: "payment-authorization",
    });

    expect(payload.tags).toEqual({
      channel: "panda",
      service: "payment",
      partner: "bcel",
      currency: "USD",
      error_code: "PAYMENT_AUTH_FAILED",
      page: "payment-confirm",
      process_step: "payment-authorization",
    });
    expect(payload.tags).not.toHaveProperty("environment");
    expect(payload.tags).not.toHaveProperty("release");
  });

  it("상세 분석 값은 Context로 만들고 개인정보 없음 상태를 표시한다", () => {
    const payload = buildCustomDataPayload({
      ...defaultCustomDataFormState,
      authenticationMethod: "biometric",
      retryCount: 2,
      apiStatus: "timeout",
      businessState: "awaiting-retry",
    });

    expect(payload.context).toEqual({
      current_business_step: "recipient-validation",
      authentication_method: "biometric",
      retry_count: 2,
      api_status: "timeout",
      business_state: "awaiting-retry",
      contains_personal_data: false,
    });
  });

  it("오류 이전 여섯 단계를 순서대로 만들고 원문 업무값은 제외한다", () => {
    const payload = buildCustomDataPayload(defaultCustomDataFormState);

    expect(payload.breadcrumbs.map(({ message }) => message)).toEqual([
      "송금 화면 진입",
      "금액 입력 완료",
      "수취인 입력 완료",
      "수취인 검증 API 요청",
      "검증 실패",
      "오류 발생",
    ]);
    expect(payload.breadcrumbs[1].data).toMatchObject({ amount_included: false });
    expect(payload.breadcrumbs[2].data).toEqual({ recipient_data_included: false });
  });

  it("검색 필드 형식과 재시도 횟수 범위를 검증한다", () => {
    const errors = validateCustomDataInput({
      ...defaultCustomDataFormState,
      errorCode: "invalid code",
      page: "Transfer Review",
      retryCount: 6,
    });

    expect(errors).toHaveLength(3);
  });
});
