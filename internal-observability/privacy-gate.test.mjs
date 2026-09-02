import assert from "node:assert/strict";
import test from "node:test";
import { PrivacyGate, buildSyntheticProfile } from "./privacy-gate.mjs";

const userId = "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH";

test("일회용 인증번호는 한 번만 사용되고 세션은 대상 사용자에 고정된다", () => {
  let currentTime = Date.parse("2026-09-02T00:00:00.000Z");
  let idSequence = 0;
  const audit = [];
  const gate = new PrivacyGate({
    now: () => currentTime,
    createId: () => `generated-id-${++idSequence}`,
    createCode: () => "123456",
    audit: (event) => audit.push(event),
  });

  const challenge = gate.requestAccess({
    pseudonymousId: userId,
    reason: "장애 재현을 위한 고객 문의 확인",
    ticket: "INC-1001",
  });
  const session = gate.verifyChallenge({ challengeId: challenge.challengeId, code: "123456" });
  assert.equal(gate.authorize(session.sessionToken, userId).ticket, "INC-1001");
  assert.throws(() => gate.authorize(session.sessionToken, `${userId}x`), /다른 사용자/);
  assert.throws(() => gate.verifyChallenge({ challengeId: challenge.challengeId, code: "123456" }), /이미 사용/);

  currentTime += 10 * 60_000 + 1;
  assert.throws(() => gate.authorize(session.sessionToken, userId), /만료/);
  assert.deepEqual(audit.map(({ action }) => action), [
    "challenge_requested",
    "session_granted",
    "profile_viewed",
  ]);
});

test("조회 결과는 합성 adapter임을 명시한다", () => {
  assert.deepEqual(buildSyntheticProfile(userId), {
    pseudonymousId: userId,
    synthetic: true,
    source: "synthetic-poc-adapter",
    name: "합성 고객 홍길동",
    phone: "010-0000-1234",
    account: "000-0000-0000-01",
    cddStatus: "VERIFIED",
  });
});
