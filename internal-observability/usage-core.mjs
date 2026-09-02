const actorIdPattern = /^(?:dbg_v1_[A-Za-z0-9_-]{20,80}|attempt_v1_[a-z0-9-]{12,64})$/;
const valuePattern = /^[a-z][a-z0-9._-]{1,63}$/;

export function normalizeUsageEvent(input, now = new Date()) {
  if (!input || typeof input !== "object") throw new Error("JSON 객체가 필요합니다.");
  if (!actorIdPattern.test(input.actorId ?? "")) throw new Error("승인된 가명 actor ID가 필요합니다.");
  if (!new Set(["activity", "error"]).has(input.kind)) throw new Error("지원하지 않는 사용량 이벤트입니다.");
  if (!valuePattern.test(input.service ?? "")) throw new Error("service 형식이 올바르지 않습니다.");
  if (input.kind === "error" && !valuePattern.test(input.issueKey ?? "")) throw new Error("issueKey 형식이 올바르지 않습니다.");

  return {
    actorId: input.actorId,
    kind: input.kind,
    service: input.service,
    ...(input.kind === "activity" ? { page: valuePattern.test(input.page ?? "") ? input.page : "unknown" } : {}),
    ...(input.kind === "error" ? { issueKey: input.issueKey } : {}),
    occurredAt: now.toISOString(),
  };
}

export function calculateNormalizedErrorRanking(events) {
  const activeUsersByService = new Map();
  const issues = new Map();

  for (const event of events) {
    if (event.kind === "activity") {
      if (!activeUsersByService.has(event.service)) activeUsersByService.set(event.service, new Set());
      activeUsersByService.get(event.service).add(event.actorId);
    }
    if (event.kind === "error") {
      const key = `${event.service}:${event.issueKey}`;
      if (!issues.has(key)) issues.set(key, { service: event.service, issueKey: event.issueKey, events: 0, users: new Set() });
      const issue = issues.get(key);
      issue.events += 1;
      issue.users.add(event.actorId);
    }
  }

  return [...issues.values()].map((issue) => {
    const activeUsers = activeUsersByService.get(issue.service)?.size ?? 0;
    const affectedUsers = issue.users.size;
    return {
      service: issue.service,
      issueKey: issue.issueKey,
      errorEvents: issue.events,
      affectedUsers,
      activeUsers,
      affectedUserRate: activeUsers === 0
        ? null
        : Number(((affectedUsers / activeUsers) * 100).toFixed(1)),
    };
  }).sort((left, right) =>
    (right.affectedUserRate ?? -1) - (left.affectedUserRate ?? -1) || right.errorEvents - left.errorEvents,
  );
}
