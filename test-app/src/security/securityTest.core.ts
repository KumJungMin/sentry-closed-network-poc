export interface SecurityTestPayload {
  user: Record<string, string>;
  context: Record<string, unknown>;
  breadcrumb: {
    category: string;
    message: string;
    data: Record<string, unknown>;
  };
  tags: Record<string, string>;
}

export const fakeSensitiveValues = {
  name: "FAKE-NAME-PHASE7",
  phone: "010-0000-0000",
  email: "phase7.person@example.invalid",
  accountNumber: "000-0000-0000-00",
  residentRegistrationNumber: "000000-1000000",
  ci: "FAKE-CI-PHASE7-ONLY",
  otp: "000000",
  accessToken: "FAKE-ACCESS-TOKEN-PHASE7",
  refreshToken: "FAKE-REFRESH-TOKEN-PHASE7",
  authorization: "Bearer FAKE-AUTHORIZATION-PHASE7",
  cookie: "session=FAKE-COOKIE-PHASE7",
  transactionId: "FAKE-TRANSACTION-ID-PHASE7",
} as const;

export function buildFakeSensitivePayload(): SecurityTestPayload {
  return {
    user: {
      id: "raw-user-id-phase7",
      username: fakeSensitiveValues.name,
      email: fakeSensitiveValues.email,
      ip_address: "203.0.113.77",
    },
    context: {
      customer_name: fakeSensitiveValues.name,
      phone_number: fakeSensitiveValues.phone,
      email_address: fakeSensitiveValues.email,
      account_number: fakeSensitiveValues.accountNumber,
      resident_registration_number: fakeSensitiveValues.residentRegistrationNumber,
      ci: fakeSensitiveValues.ci,
      otp_code: fakeSensitiveValues.otp,
      access_token: fakeSensitiveValues.accessToken,
      refresh_token: fakeSensitiveValues.refreshToken,
      authorization: fakeSensitiveValues.authorization,
      cookie: fakeSensitiveValues.cookie,
      sender_info: { name: fakeSensitiveValues.name, account_number: fakeSensitiveValues.accountNumber },
      recipient_info: { name: "FAKE-RECIPIENT-PHASE7", account_number: "111-1111-1111-11" },
      raw_request: { body: "FAKE-RAW-REQUEST-PHASE7" },
      raw_response: { body: "FAKE-RAW-RESPONSE-PHASE7" },
      input_form: { full_input: "FAKE-FULL-FORM-PHASE7" },
      transaction_id: fakeSensitiveValues.transactionId,
      request_url: `http://127.0.0.1:5173/payment?account=${fakeSensitiveValues.accountNumber}#confirm`,
      safe_business_state: "privacy-scrub-test",
    },
    breadcrumb: {
      category: "phase7.security-test",
      message: `Authorization: ${fakeSensitiveValues.authorization}`,
      data: {
        url: `http://127.0.0.1:5173/api/payment?email=${fakeSensitiveValues.email}`,
        headers: {
          Authorization: fakeSensitiveValues.authorization,
          Cookie: fakeSensitiveValues.cookie,
        },
        request_body: `name=${fakeSensitiveValues.name}`,
        response_body: "FAKE-RAW-RESPONSE-PHASE7",
      },
    },
    tags: {
      security_phase: "phase7",
      test_case: "pii-scrubbing",
      synthetic_data_only: "true",
    },
  };
}
