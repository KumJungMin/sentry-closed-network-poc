import assert from "node:assert/strict";
import test from "node:test";
import { pseudonymizeUserId } from "./identity-core.mjs";

const secret = "local-poc-secret-do-not-use-in-production";
const rawId = "123e4567-e89b-42d3-a456-426614174000";

test("동일 UUID는 Relay 허용 형식의 동일 가명 ID가 된다", () => {
  const first = pseudonymizeUserId(rawId, secret);
  assert.equal(first, pseudonymizeUserId(rawId.toUpperCase(), secret));
  assert.match(first, /^dbg_v1_[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(first, /123e4567/);
});

test("UUID가 아닌 사용자 식별자는 거부한다", () => {
  assert.throws(() => pseudonymizeUserId("customer@example.invalid", secret), /UUID/);
});
