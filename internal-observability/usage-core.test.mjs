import assert from "node:assert/strict";
import test from "node:test";
import { calculateNormalizedErrorRanking, normalizeUsageEvent } from "./usage-core.mjs";

test("사용자 오류율을 서비스 활성 사용자 모수로 계산한다", () => {
  const activity = (actorId, service) => ({ actorId, service, kind: "activity" });
  const error = (actorId, service, issueKey) => ({ actorId, service, issueKey, kind: "error" });
  const ranking = calculateNormalizedErrorRanking([
    activity("dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH", "payment"),
    activity("dbg_v1_Q8pW2nM5kR7xT4cD9fH3sL6a", "payment"),
    error("dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH", "payment", "synthetic.payment.timeout"),
    error("dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH", "payment", "synthetic.payment.timeout"),
  ]);
  assert.deepEqual(ranking[0], {
    service: "payment",
    issueKey: "synthetic.payment.timeout",
    errorEvents: 2,
    affectedUsers: 1,
    activeUsers: 2,
    affectedUserRate: 50,
  });
});

test("정규화 단계에서 허용 필드만 저장한다", () => {
  const normalized = normalizeUsageEvent({
    actorId: "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH",
    kind: "activity",
    service: "membership",
    page: "signup.terms",
    email: "must-not-store@example.invalid",
  }, new Date("2026-09-02T00:00:00.000Z"));
  assert.deepEqual(Object.keys(normalized), ["actorId", "kind", "service", "page", "occurredAt"]);
});
