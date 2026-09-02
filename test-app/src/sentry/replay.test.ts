import { describe, expect, it } from "vitest";
import { replayPrivacyOptions } from "./replay";

describe("Replay 개인정보 보호 설정", () => {
  it("텍스트·입력·미디어와 명시적 개인정보 영역을 항상 가린다", () => {
    expect(replayPrivacyOptions).toMatchObject({
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
    });
    expect(replayPrivacyOptions.block).toContain("[data-private]");
  });

  it("요청·응답 body와 추가 header를 녹화하지 않는다", () => {
    expect(replayPrivacyOptions.networkDetailAllowUrls).toEqual([]);
    expect(replayPrivacyOptions.networkCaptureBodies).toBe(false);
    expect(replayPrivacyOptions.networkRequestHeaders).toEqual([]);
    expect(replayPrivacyOptions.networkResponseHeaders).toEqual([]);
  });
});
