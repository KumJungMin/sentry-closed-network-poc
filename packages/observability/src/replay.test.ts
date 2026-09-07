import { describe, expect, it } from "vitest";
import { replayPrivacyOptions } from "./replay.js";

describe("오류 전용 Replay 정책", () => {
  it("텍스트, 입력, 미디어를 모두 보호한다", () => {
    expect(replayPrivacyOptions).toMatchObject({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    });
    expect(replayPrivacyOptions.block).toContain("[data-private]");
  });

  it("네트워크 본문과 헤더를 수집하지 않는다", () => {
    expect(replayPrivacyOptions.networkDetailAllowUrls).toEqual([]);
    expect(replayPrivacyOptions.networkCaptureBodies).toBe(false);
    expect(replayPrivacyOptions.networkRequestHeaders).toEqual([]);
    expect(replayPrivacyOptions.networkResponseHeaders).toEqual([]);
  });
});
