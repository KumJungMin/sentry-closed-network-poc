import { describe, expect, it, vi } from "vitest";
import { clearFunnelSession, readFunnelSession, writeFunnelSession } from "./funnelSession";

describe("funnel session", () => {
  it("유효한 가입 시도와 현재 화면을 저장하고 복원한다", () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    };

    writeFunnelSession(
      { attemptId: "attempt_v1_123456789abc", furthestStep: "account" },
      adapter,
    );

    expect(readFunnelSession(adapter)).toEqual({
      attemptId: "attempt_v1_123456789abc",
      furthestStep: "account",
    });
  });

  it("손상되거나 허용되지 않은 세션은 사용하지 않는다", () => {
    expect(readFunnelSession({ getItem: () => "not-json" })).toBeNull();
    expect(readFunnelSession({
      getItem: () => JSON.stringify({ attemptId: "raw-id", furthestStep: "terms" }),
    })).toBeNull();
  });

  it("완료된 가입 시도를 제거한다", () => {
    const removeItem = vi.fn();
    clearFunnelSession({ removeItem });
    expect(removeItem).toHaveBeenCalledOnce();
  });
});
