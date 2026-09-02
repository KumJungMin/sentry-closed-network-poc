export const channelOptions = ["hana-ez", "bcel", "panda"] as const;
export const serviceOptions = ["remittance", "payment", "membership"] as const;
export const currencyOptions = ["KRW", "LAK", "USD"] as const;
export const processStepOptions = [
  "recipient-validation",
  "payment-authorization",
  "membership-verification",
] as const;
export const authenticationMethodOptions = ["pin", "biometric", "otp"] as const;
export const apiStatusOptions = ["rejected", "timeout", "unavailable", "invalid"] as const;
export const businessStateOptions = ["validation-failed", "awaiting-retry", "blocked"] as const;

export interface CustomDataFormState {
  channel: (typeof channelOptions)[number];
  service: (typeof serviceOptions)[number];
  partner: "bcel";
  currency: (typeof currencyOptions)[number];
  errorCode: string;
  page: string;
  processStep: (typeof processStepOptions)[number];
  authenticationMethod: (typeof authenticationMethodOptions)[number];
  retryCount: number;
  apiStatus: (typeof apiStatusOptions)[number];
  businessState: (typeof businessStateOptions)[number];
}

export interface BusinessBreadcrumb {
  category: "webview.business-flow";
  message: string;
  level: "info" | "warning" | "error";
  data?: Record<string, string | number | boolean>;
}

export interface CustomDataPayload {
  tags: Record<string, string>;
  context: Record<string, string | number | boolean>;
  breadcrumbs: BusinessBreadcrumb[];
}

export const defaultCustomDataFormState: CustomDataFormState = {
  channel: "hana-ez",
  service: "remittance",
  partner: "bcel",
  currency: "KRW",
  errorCode: "RECIPIENT_VALIDATION_FAILED",
  page: "transfer-review",
  processStep: "recipient-validation",
  authenticationMethod: "pin",
  retryCount: 1,
  apiStatus: "rejected",
  businessState: "validation-failed",
};

export function validateCustomDataInput(input: CustomDataFormState): string[] {
  const errors: string[] = [];

  if (!/^[A-Z0-9_]+$/.test(input.errorCode.trim())) {
    errors.push("오류 코드는 영문 대문자, 숫자, 밑줄만 사용할 수 있습니다.");
  }

  if (!/^[a-z0-9-]+$/.test(input.page.trim())) {
    errors.push("페이지는 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  }

  if (!Number.isInteger(input.retryCount) || input.retryCount < 0 || input.retryCount > 5) {
    errors.push("재시도 횟수는 0부터 5 사이의 정수여야 합니다.");
  }

  return errors;
}

export function buildCustomDataPayload(input: CustomDataFormState): CustomDataPayload {
  const errorCode = input.errorCode.trim();
  const page = input.page.trim();

  return {
    tags: {
      channel: input.channel,
      service: input.service,
      partner: input.partner,
      currency: input.currency,
      error_code: errorCode,
      page,
      process_step: input.processStep,
    },
    context: {
      current_business_step: input.processStep,
      authentication_method: input.authenticationMethod,
      retry_count: input.retryCount,
      api_status: input.apiStatus,
      business_state: input.businessState,
      contains_personal_data: false,
    },
    breadcrumbs: [
      {
        category: "webview.business-flow",
        message: "송금 화면 진입",
        level: "info",
        data: {
          channel: input.channel,
          service: input.service,
          page,
        },
      },
      {
        category: "webview.business-flow",
        message: "금액 입력 완료",
        level: "info",
        data: {
          currency: input.currency,
          amount_included: false,
        },
      },
      {
        category: "webview.business-flow",
        message: "수취인 입력 완료",
        level: "info",
        data: { recipient_data_included: false },
      },
      {
        category: "webview.business-flow",
        message: "수취인 검증 API 요청",
        level: "info",
        data: {
          endpoint_alias: "recipient-validation",
          method: "POST",
        },
      },
      {
        category: "webview.business-flow",
        message: "검증 실패",
        level: "warning",
        data: {
          error_code: errorCode,
          api_status: input.apiStatus,
        },
      },
      {
        category: "webview.business-flow",
        message: "오류 발생",
        level: "error",
        data: {
          process_step: input.processStep,
          business_state: input.businessState,
        },
      },
    ],
  };
}
