import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = JSON.parse(await readFile(new URL("./phase7-relay-pii-config.json", import.meta.url), "utf8"));
const rule = config.rules["phase7-remove-invalid-user-id-v1"];
const invalidUserIdPattern = new RegExp(rule.pattern);

test("Relay는 승인된 dbg_v1 사용자 ID를 보존한다", () => {
  assert.equal(invalidUserIdPattern.test("dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH"), false);
  assert.deepEqual(config.applications["$user.id"], ["phase7-remove-invalid-user-id-v1"]);
});

test("Relay는 원본·짧은·잘못된 문자 사용자 ID를 제거한다", () => {
  for (const userId of [
    "raw-user-id-phase7",
    "anon-c9fe82a110",
    "dbg_v1_short",
    "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH!",
  ]) {
    assert.equal(invalidUserIdPattern.test(userId), true, userId);
  }
});
