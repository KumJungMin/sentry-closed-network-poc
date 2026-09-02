import { describe, expect, it } from "vitest";
import { isPseudonymousDebugId } from "./identity.core";

describe("가명 디버그 ID", () => {
  it("버전 prefix와 충분한 entropy를 가진 ID만 허용한다", () => {
    expect(isPseudonymousDebugId("dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH")).toBe(true);
    expect(isPseudonymousDebugId("anon-c9fe82a110")).toBe(false);
    expect(isPseudonymousDebugId("dbg_v1_too-short")).toBe(false);
  });
});
