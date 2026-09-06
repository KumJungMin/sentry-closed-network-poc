export const signupSteps = Object.freeze([
  { id: "terms", label: "약관 동의" },
  { id: "account", label: "계좌 인증" },
  { id: "phone", label: "휴대폰 인증" },
  { id: "cdd", label: "CDD" },
]);

export const DEFAULT_FUNNEL_DROPOFF_GRACE_PERIOD_MS = 30 * 60 * 1000;

const stepIds = new Set(signupSteps.map(({ id }) => id));
const eventNames = new Set(["page_view", "entered", "advanced", "abandoned", "completed"]);
const pageViewEventNames = new Set(["page_view", "entered"]);
const attemptIdPattern = /^attempt_v1_[a-z0-9-]{12,64}$/;

export function normalizeAnalyticsEvent(input, now = new Date()) {
  if (!input || typeof input !== "object") throw new Error("JSON 객체가 필요합니다.");
  if (!attemptIdPattern.test(input.attemptId ?? "")) throw new Error("유효하지 않은 가입 시도 ID입니다.");
  if (!stepIds.has(input.step)) throw new Error("유효하지 않은 가입 단계입니다.");
  if (!eventNames.has(input.event)) throw new Error("유효하지 않은 퍼널 이벤트입니다.");

  return {
    attemptId: input.attemptId,
    step: input.step,
    event: input.event,
    pagePath: `/signup-funnel/${input.step}`,
    service: "membership",
    occurredAt: now.toISOString(),
  };
}

export function calculateFunnel(events, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const dropOffGracePeriodMs = Number.isFinite(options.dropOffGracePeriodMs)
    && options.dropOffGracePeriodMs >= 0
    ? options.dropOffGracePeriodMs
    : DEFAULT_FUNNEL_DROPOFF_GRACE_PERIOD_MS;
  const viewedAtByStep = new Map(signupSteps.map(({ id }) => [id, new Map()]));
  const abandonedByStep = new Map(signupSteps.map(({ id }) => [id, new Set()]));
  const completedAttempts = new Set();

  for (const event of events) {
    if (pageViewEventNames.has(event.event)) {
      const viewedAt = Date.parse(event.occurredAt ?? "");
      const stepViews = viewedAtByStep.get(event.step);
      const previousViewedAt = stepViews?.get(event.attemptId) ?? Number.NEGATIVE_INFINITY;
      stepViews?.set(event.attemptId, Math.max(previousViewedAt, viewedAt));
    }
    if (event.event === "abandoned") abandonedByStep.get(event.step)?.add(event.attemptId);
    if (event.event === "completed" && event.step === "cdd") completedAttempts.add(event.attemptId);
  }

  const firstStepCount = viewedAtByStep.get("terms")?.size ?? 0;
  const steps = signupSteps.map((step, index) => {
    const stepViews = viewedAtByStep.get(step.id) ?? new Map();
    const nextStepViews = index === signupSteps.length - 1
      ? null
      : viewedAtByStep.get(signupSteps[index + 1].id);
    let progressed = 0;
    let dropOff = 0;
    let pendingDropOff = 0;

    for (const [attemptId, lastViewedAt] of stepViews) {
      const reachedNextStep = nextStepViews
        ? nextStepViews.has(attemptId)
        : completedAttempts.has(attemptId);
      if (reachedNextStep) {
        progressed += 1;
        continue;
      }

      const explicitlyAbandoned = abandonedByStep.get(step.id)?.has(attemptId) ?? false;
      const gracePeriodExpired = !Number.isFinite(lastViewedAt)
        || now.getTime() - lastViewedAt >= dropOffGracePeriodMs;
      if (explicitlyAbandoned || gracePeriodExpired) dropOff += 1;
      else pendingDropOff += 1;
    }

    const reached = stepViews.size;

    return {
      ...step,
      reached,
      dropOff,
      pendingDropOff,
      dropOffRate: reached === 0 ? 0 : Number(((dropOff / reached) * 100).toFixed(1)),
      conversionRate: firstStepCount === 0
        ? 0
        : Number(((progressed / firstStepCount) * 100).toFixed(1)),
    };
  });

  return {
    dropOffGracePeriodMs,
    totalAttempts: firstStepCount,
    completedAttempts: completedAttempts.size,
    steps,
  };
}
