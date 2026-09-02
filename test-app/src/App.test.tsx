import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

const runMocks = vi.hoisted(() =>
  Array.from({ length: 7 }, (_, index) =>
    vi.fn(async () => ({
      tone: "sent" as const,
      summary: `테스트 ${index + 1} 완료`,
      detail: `테스트 ${index + 1} 상세`,
    })),
  ),
);

vi.mock("./sentry/client", () => ({
  sentryRuntime: {
    enabled: true,
    environment: "local",
    release: "frontend-poc@0.1.0",
  },
}));

vi.mock("./sentry/actions", () => ({
  testActions: Array.from({ length: 7 }, (_, index) => ({
    id: `test-${index + 1}`,
    index: index + 1,
    title: `테스트 ${index + 1}`,
    sentryFeature: `Sentry API ${index + 1}`,
    description: `테스트 ${index + 1} 설명`,
    expectedResult: `테스트 ${index + 1} 예상 결과`,
    run: runMocks[index],
  })),
}));

describe("App", () => {
  it("연결 정보와 일곱 개 테스트를 렌더링한다", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Sentry 이벤트 실험실" })).toBeTruthy();
    expect(screen.getByText("SDK 연결됨")).toBeTruthy();
    expect(screen.getAllByText("frontend-poc@0.1.0")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "테스트 실행" })).toHaveLength(7);
  });

  it("버튼 실행 결과를 최근 실행 목록에 추가한다", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "테스트 실행" })[0]);

    expect(await screen.findByText("테스트 1 완료")).toBeTruthy();
    expect(runMocks[0]).toHaveBeenCalledTimes(1);
  });

  it("비동기 테스트가 실행되는 동안 버튼을 비활성화한다", async () => {
    let finishRun: (() => void) | undefined;
    runMocks[6].mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRun = () => resolve({
            tone: "sent",
            summary: "비동기 테스트 완료",
            detail: "완료됨",
          });
        }),
    );
    const user = userEvent.setup();
    render(<App />);
    const button = screen.getAllByRole("button", { name: "테스트 실행" })[6];

    await user.click(button);

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(
      screen
        .getAllByRole("button", { name: /다른 테스트 실행 중|실행 중…/ })
        .every((item) => item.hasAttribute("disabled")),
    ).toBe(true);
    expect(screen.getAllByRole("button", { name: "다른 테스트 실행 중" })).toHaveLength(6);
    finishRun?.();
    await waitFor(() => expect(screen.getByText("비동기 테스트 완료")).toBeTruthy());
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it("action 자체 실패를 사용자에게 표시한다", async () => {
    runMocks[0].mockRejectedValueOnce(new Error("테스트 action 실패"));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "테스트 실행" })[0]);

    expect(await screen.findByText("테스트 실행 중 예상하지 못한 오류가 발생했습니다.")).toBeTruthy();
    expect(screen.getByText("테스트 action 실패")).toBeTruthy();
  });
});
