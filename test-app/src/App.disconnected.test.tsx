import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "./App";

vi.mock("./sentry/client", () => ({
  sentryRuntime: {
    enabled: false,
    environment: "local",
    release: "frontend-poc@0.1.0",
  },
}));

vi.mock("./sentry/actions", () => ({ testActions: [] }));

describe("App SDK 미연결 상태", () => {
  it("DSN 설정 안내를 표시한다", () => {
    render(<App />);

    expect(screen.getByText("SDK 미연결")).toBeTruthy();
    expect(screen.getByText("DSN 설정이 필요합니다.")).toBeTruthy();
    expect(screen.getByText(/VITE_SENTRY_DSN/)).toBeTruthy();
  });
});
