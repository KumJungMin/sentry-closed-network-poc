import * as Sentry from "@sentry/react";

export const logScenarios = [
  {
    id: "action-completed",
    level: "info",
    title: "정상 업무 로그",
    message: "frontend_action_completed",
    description: "가입 약관 화면의 정상 완료를 구조화 로그로 기록합니다.",
    attributes: { service: "membership", page: "signup.terms", action: "accept_terms" },
  },
  {
    id: "api-slow",
    level: "warn",
    title: "지연 경고 로그",
    message: "frontend_api_slow",
    description: "휴대폰 인증 API의 지연 임계치 초과를 기록합니다.",
    attributes: { service: "membership", page: "signup.phone", duration_ms: 2300 },
  },
  {
    id: "payment-failed",
    level: "error",
    title: "오류 로그 + Issue",
    message: "frontend_payment_failed",
    description: "결제 실패 로그와 동일한 문맥의 오류 Issue를 함께 생성합니다.",
    attributes: { service: "payment", page: "payment.confirm", error_code: "SYNTHETIC_TIMEOUT" },
  },
] as const;

export type LogScenarioId = (typeof logScenarios)[number]["id"];

export async function emitStructuredLog(id: LogScenarioId): Promise<string> {
  const scenario = logScenarios.find((item) => item.id === id);
  if (!scenario) throw new Error("지원하지 않는 로그 시나리오입니다.");

  const attributes = {
    ...scenario.attributes,
    source: "frontend-poc",
    synthetic: true,
  };

  if (scenario.level === "info") Sentry.logger.info(scenario.message, attributes);
  if (scenario.level === "warn") Sentry.logger.warn(scenario.message, attributes);
  if (scenario.level === "error") {
    Sentry.logger.error(scenario.message, attributes);
    Sentry.withScope((scope) => {
      scope.setTags({ service: scenario.attributes.service, page: scenario.attributes.page });
      scope.setContext("structured_log", { message: scenario.message, ...attributes });
      Sentry.captureException(new Error("[PoC] synthetic payment timeout"));
    });
  }

  const flushed = await Sentry.flush(3000);
  if (!flushed) throw new Error("제한 시간 안에 로그 전송이 끝나지 않았습니다.");
  return scenario.message;
}
