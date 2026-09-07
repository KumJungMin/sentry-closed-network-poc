export const FLOW_DEFINITIONS = Object.freeze({
  membership: Object.freeze({
    service: "frontend-membership",
    version: 1,
    dropOffGracePeriodMs: 30 * 60 * 1000,
    steps: Object.freeze([
      { id: "terms", label: "약관 동의", path: "/signup/terms" },
      { id: "account", label: "계정 정보", path: "/signup/account" },
      { id: "phone", label: "휴대폰 인증", path: "/signup/phone" },
      { id: "identity", label: "본인 확인", path: "/signup/identity" },
      { id: "result", label: "가입 완료", path: "/signup/complete" },
    ]),
  }),
  remittance: Object.freeze({
    service: "frontend-remittance",
    version: 1,
    dropOffGracePeriodMs: 15 * 60 * 1000,
    steps: Object.freeze([
      { id: "recipient", label: "수취인", path: "/remittance/recipient" },
      { id: "amount", label: "송금 금액", path: "/remittance/amount" },
      { id: "review", label: "송금 확인", path: "/remittance/review" },
      { id: "authenticate", label: "송금 인증", path: "/remittance/authenticate" },
      { id: "result", label: "송금 결과", path: "/remittance/result" },
    ]),
  }),
  payment: Object.freeze({
    service: "frontend-payment",
    version: 1,
    dropOffGracePeriodMs: 5 * 60 * 1000,
    steps: Object.freeze([
      { id: "order", label: "주문 확인", path: "/payment/order" },
      { id: "method", label: "결제 수단", path: "/payment/method" },
      { id: "review", label: "결제 확인", path: "/payment/review" },
      { id: "authenticate", label: "결제 인증", path: "/payment/authenticate" },
      { id: "result", label: "결제 결과", path: "/payment/result" },
    ]),
  }),
});

const eventNames = new Set([
  "flow_started",
  "step_viewed",
  "step_validation_failed",
  "step_submitted",
  "step_succeeded",
  "step_failed",
  "flow_cancelled",
  "flow_completed",
]);
const outcomeNames = new Set([
  "success",
  "validation_error",
  "business_decline",
  "technical_error",
  "cancelled",
]);
const attemptIdPattern = /^attempt_v1_[a-z0-9-]{12,64}$/;
const errorCodePattern = /^[A-Z0-9_:-]{1,64}$/;

function getFlowDefinition(flowName) {
  const definition = FLOW_DEFINITIONS[flowName];
  if (!definition) throw new Error("유효하지 않은 도메인 플로우입니다.");
  return definition;
}

export function normalizeFlowAnalyticsEvent(input, now = new Date()) {
  if (!input || typeof input !== "object") throw new Error("JSON 객체가 필요합니다.");
  const definition = getFlowDefinition(input.flowName);
  const step = definition.steps.find(({ id }) => id === input.step);
  if (!attemptIdPattern.test(input.attemptId ?? "")) throw new Error("유효하지 않은 플로우 시도 ID입니다.");
  if (!step) throw new Error("현재 플로우에 속하지 않은 단계입니다.");
  if (!eventNames.has(input.event)) throw new Error("유효하지 않은 플로우 이벤트입니다.");
  if (input.userId !== undefined && (typeof input.userId !== "string" || input.userId.length === 0 || input.userId.length > 128)) {
    throw new Error("user.id는 1자 이상 128자 이하여야 합니다.");
  }
  if (input.outcome !== undefined && !outcomeNames.has(input.outcome)) {
    throw new Error("유효하지 않은 플로우 결과입니다.");
  }
  if (input.errorCode !== undefined && !errorCodePattern.test(input.errorCode)) {
    throw new Error("유효하지 않은 오류 코드입니다.");
  }
  if (input.event === "flow_started" && definition.steps[0].id !== input.step) {
    throw new Error("플로우 시작 이벤트는 첫 단계에서만 기록할 수 있습니다.");
  }
  if (input.event === "flow_completed" && definition.steps.at(-1).id !== input.step) {
    throw new Error("플로우 완료 이벤트는 마지막 단계에서만 기록할 수 있습니다.");
  }

  return {
    schemaVersion: 1,
    attemptId: input.attemptId,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    flowName: input.flowName,
    flowVersion: definition.version,
    step: input.step,
    event: input.event,
    ...(input.outcome === undefined ? {} : { outcome: input.outcome }),
    ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode }),
    pagePath: step.path,
    service: definition.service,
    occurredAt: now.toISOString(),
  };
}

export function calculateFlowFunnel(events, options) {
  const flowName = options?.flowName;
  const definition = getFlowDefinition(flowName);
  const now = options?.now instanceof Date ? options.now : new Date();
  const configuredGrace = options?.dropOffGracePeriodMs;
  const dropOffGracePeriodMs = Number.isFinite(configuredGrace) && configuredGrace >= 0
    ? configuredGrace
    : definition.dropOffGracePeriodMs;
  const viewedAtByStep = new Map(definition.steps.map(({ id }) => [id, new Map()]));
  const cancelledByStep = new Map(definition.steps.map(({ id }) => [id, new Set()]));
  const completedAttempts = new Set();

  for (const event of events) {
    if (event.flowName !== flowName) continue;
    if (event.event === "flow_started" || event.event === "step_viewed") {
      const viewedAt = Date.parse(event.occurredAt ?? "");
      const views = viewedAtByStep.get(event.step);
      const previous = views?.get(event.attemptId) ?? Number.NEGATIVE_INFINITY;
      views?.set(event.attemptId, Math.max(previous, viewedAt));
    }
    if (event.event === "flow_cancelled") cancelledByStep.get(event.step)?.add(event.attemptId);
    if (event.event === "flow_completed") completedAttempts.add(event.attemptId);
  }

  const totalAttempts = viewedAtByStep.get(definition.steps[0].id)?.size ?? 0;
  const steps = definition.steps.map((step, index) => {
    const stepViews = viewedAtByStep.get(step.id) ?? new Map();
    const nextStep = definition.steps[index + 1];
    const nextViews = nextStep ? viewedAtByStep.get(nextStep.id) : undefined;
    let progressed = 0;
    let dropOff = 0;
    let pendingDropOff = 0;

    for (const [attemptId, lastViewedAt] of stepViews) {
      const reachedNext = nextViews?.has(attemptId) ?? completedAttempts.has(attemptId);
      if (reachedNext) {
        progressed += 1;
        continue;
      }
      const explicitlyCancelled = cancelledByStep.get(step.id)?.has(attemptId) ?? false;
      const graceExpired = !Number.isFinite(lastViewedAt)
        || now.getTime() - lastViewedAt >= dropOffGracePeriodMs;
      if (explicitlyCancelled || graceExpired) dropOff += 1;
      else pendingDropOff += 1;
    }

    return {
      ...step,
      reached: stepViews.size,
      progressed,
      dropOff,
      pendingDropOff,
      dropOffRate: stepViews.size === 0 ? 0 : Number(((dropOff / stepViews.size) * 100).toFixed(1)),
      conversionRate: totalAttempts === 0 ? 0 : Number(((progressed / totalAttempts) * 100).toFixed(1)),
    };
  });

  return {
    flowName,
    flowVersion: definition.version,
    service: definition.service,
    dropOffGracePeriodMs,
    totalAttempts,
    completedAttempts: completedAttempts.size,
    steps,
  };
}

export function calculateAllFlowFunnels(events, options = {}) {
  return Object.fromEntries(
    Object.keys(FLOW_DEFINITIONS).map((flowName) => [
      flowName,
      calculateFlowFunnel(events, { ...options, flowName }),
    ]),
  );
}
