import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const config = JSON.parse(await readFile(new URL("./phase7-relay-pii-config.json", import.meta.url), "utf8"));

test("Relay 개인정보 규칙은 user.id를 제거하지 않는다", () => {
  assert.equal(config.applications["$user.id"], undefined);
  assert.equal(config.rules["phase7-remove-invalid-user-id-v1"], undefined);
  assert.deepEqual(config.applications["$user.email"], ["phase7-remove-anything-v1"]);
  assert.deepEqual(config.applications["$user.username"], ["phase7-remove-anything-v1"]);
});
