import * as Sentry from "@sentry/react";
import type { ActionResult, TestActionDefinition } from "../types";

const missingApiPath = "/api/sentry-poc/does-not-exist";

const sent = (summary: string, detail: string): ActionResult => ({
  tone: "sent",
  summary,
  detail,
});

export async function triggerUnhandledError(): Promise<ActionResult> {
  window.setTimeout(() => {
    throw new Error("[PoC] Unhandled JavaScript error");
  }, 0);

  return {
    tone: "scheduled",
    summary: "전역 JavaScript 오류를 예약했습니다.",
    detail: "다음 이벤트 루프에서 오류가 발생하며 Sentry 전역 핸들러가 수집합니다.",
  };
}

export async function captureHandledException(): Promise<ActionResult> {
  const eventId = Sentry.captureException(
    new Error("[PoC] Handled exception sent with captureException"),
  );

  return sent(
    "처리된 예외를 전송했습니다.",
    `captureException event id: ${eventId}`,
  );
}

export async function captureBusinessMessage(): Promise<ActionResult> {
  const eventId = Sentry.captureMessage(
    "[PoC] Remittance validation business warning",
    "warning",
  );

  return sent(
    "업무 메시지를 warning 레벨로 전송했습니다.",
    `captureMessage event id: ${eventId}`,
  );
}

export async function callMissingApi(): Promise<ActionResult> {
  try {
    const response = await fetch(missingApiPath, {
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      throw new Error(`[PoC] Missing API unexpectedly returned ${response.status}`);
    }

    const error = new Error(`[PoC] API request failed with HTTP ${response.status}`);

    Sentry.withScope((scope) => {
      scope.setTag("test_case", "failed-api");
      scope.setContext("http_failure", {
        method: "GET",
        path: missingApiPath,
        status_code: response.status,
      });
      Sentry.captureException(error);
    });

    return {
      tone: "expected-error",
      summary: `존재하지 않는 API가 HTTP ${response.status}로 실패했습니다.`,
      detail: "Fetch breadcrumb와 정제된 실패 정보가 Sentry 예외에 포함됩니다.",
    };
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error("[PoC] Unknown API failure");
    Sentry.captureException(error);

    return {
      tone: "expected-error",
      summary: "API 네트워크 실패를 수집했습니다.",
      detail: error.message,
    };
  }
}

export async function captureBreadcrumbError(): Promise<ActionResult> {
  Sentry.withScope((scope) => {
    scope.addBreadcrumb({
      category: "remittance.flow",
      message: "송금 화면 진입",
      level: "info",
    });
    scope.addBreadcrumb({
      category: "remittance.flow",
      message: "금액 입력 완료",
      level: "info",
      data: { currency: "KRW" },
    });
    scope.addBreadcrumb({
      category: "remittance.flow",
      message: "수취인 검증 실패",
      level: "warning",
      data: { error_code: "POC_RECIPIENT_INVALID" },
    });
    Sentry.captureException(new Error("[PoC] Error after remittance breadcrumbs"));
  });

  return sent(
    "Breadcrumb 세 개를 추가한 뒤 예외를 전송했습니다.",
    "이벤트 상세의 Breadcrumbs에서 업무 흐름 순서를 확인할 수 있습니다.",
  );
}

export async function captureTagAndContextError(): Promise<ActionResult> {
  Sentry.withScope((scope) => {
    scope.setTags({
      test_case: "tag-context",
      channel: "hana-ez",
      service: "remittance",
      environment: "local",
      page: "transfer-review",
    });
    scope.setContext("business_state", {
      process_step: "recipient-validation",
      authentication_method: "poc-mock",
      retry_count: 1,
      api_status: "rejected",
    });
    Sentry.captureException(new Error("[PoC] Error with isolated tags and context"));
  });

  return sent(
    "Tag와 Context가 있는 예외를 전송했습니다.",
    "Tag는 검색·집계 후보이고 Context는 이벤트 상세 분석용입니다.",
  );
}

export async function measureSlowOperation(): Promise<ActionResult> {
  await Sentry.startSpan(
    {
      name: "poc.slow-operation",
      op: "ui.slow-task",
      attributes: {
        "poc.test_case": "slow-operation",
        "poc.expected_duration_ms": 1200,
      },
    },
    async (span) => {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
      span.setAttribute("poc.result", "completed");
    },
  );

  return sent(
    "느린 작업 Span 측정을 완료했습니다.",
    "약 1.2초의 poc.slow-operation을 Sentry Traces에서 확인할 수 있습니다.",
  );
}

export const testActions: TestActionDefinition[] = [
  {
    id: "unhandled-error",
    index: 1,
    title: "일반 JavaScript 오류",
    sentryFeature: "전역 오류 자동 수집",
    description: "처리하지 않은 Error를 다음 이벤트 루프에서 발생시킵니다.",
    expectedResult: "Issue에 예외와 브라우저 stack trace가 생성됩니다.",
    run: triggerUnhandledError,
  },
  {
    id: "captured-exception",
    index: 2,
    title: "처리된 오류 전송",
    sentryFeature: "captureException",
    description: "앱이 처리한 Error 객체를 명시적으로 Sentry에 보냅니다.",
    expectedResult: "처리된 예외도 별도 Issue 후보로 수집됩니다.",
    run: captureHandledException,
  },
  {
    id: "business-message",
    index: 3,
    title: "업무 오류 메시지",
    sentryFeature: "captureMessage",
    description: "예외 객체가 없는 업무 경고를 warning 레벨로 전송합니다.",
    expectedResult: "메시지 이벤트와 warning 레벨을 확인할 수 있습니다.",
    run: captureBusinessMessage,
  },
  {
    id: "failed-api",
    index: 4,
    title: "존재하지 않는 API 호출",
    sentryFeature: "Fetch breadcrumb + Exception",
    description: "없는 JSON API를 호출해 HTTP 실패를 만들고 정제해 전송합니다.",
    expectedResult: "요청 breadcrumb와 HTTP 상태가 이벤트에 남습니다.",
    run: callMissingApi,
  },
  {
    id: "breadcrumb-error",
    index: 5,
    title: "Breadcrumb 후 오류",
    sentryFeature: "addBreadcrumb",
    description: "송금 흐름 세 단계를 기록한 다음 오류를 전송합니다.",
    expectedResult: "오류 이전의 업무 흐름이 시간순으로 표시됩니다.",
    run: captureBreadcrumbError,
  },
  {
    id: "tag-context-error",
    index: 6,
    title: "Tag와 Context 후 오류",
    sentryFeature: "setTags + setContext",
    description: "검색용 Tag와 상세 분석용 Context를 격리된 scope에 추가합니다.",
    expectedResult: "이벤트의 Tags와 Context 영역에서 값이 구분됩니다.",
    run: captureTagAndContextError,
  },
  {
    id: "slow-operation",
    index: 7,
    title: "느린 작업 측정",
    sentryFeature: "startSpan",
    description: "약 1.2초 동안 실행되는 사용자 지정 작업을 측정합니다.",
    expectedResult: "poc.slow-operation Span과 소요 시간이 기록됩니다.",
    run: measureSlowOperation,
  },
];
