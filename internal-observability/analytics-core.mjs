export const signupSteps = Object.freeze([
  { id: "terms", label: "약관 동의" },
  { id: "account", label: "계좌 인증" },
  { id: "phone", label: "휴대폰 인증" },
  { id: "cdd", label: "CDD" },
]);

const stepIds = new Set(signupSteps.map(({ id }) => id));
const eventNames = new Set(["entered", "advanced", "abandoned", "completed"]);
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
    service: "membership",
    occurredAt: now.toISOString(),
  };
}

export function calculateFunnel(events) {
  const reachedByStep = new Map(signupSteps.map(({ id }) => [id, new Set()]));
  const completedAttempts = new Set();

  for (const event of events) {
    if (event.event === "entered") reachedByStep.get(event.step)?.add(event.attemptId);
    if (event.event === "completed" && event.step === "cdd") completedAttempts.add(event.attemptId);
  }

  const firstStepCount = reachedByStep.get("terms")?.size ?? 0;
  const steps = signupSteps.map((step, index) => {
    const reached = reachedByStep.get(step.id)?.size ?? 0;
    const nextReached = index === signupSteps.length - 1
      ? completedAttempts.size
      : reachedByStep.get(signupSteps[index + 1].id)?.size ?? 0;
    const dropOff = Math.max(0, reached - nextReached);

    return {
      ...step,
      reached,
      dropOff,
      dropOffRate: reached === 0 ? 0 : Number(((dropOff / reached) * 100).toFixed(1)),
      conversionRate: firstStepCount === 0
        ? 0
        : Number(((nextReached / firstStepCount) * 100).toFixed(1)),
    };
  });

  return {
    totalAttempts: firstStepCount,
    completedAttempts: completedAttempts.size,
    steps,
  };
}
