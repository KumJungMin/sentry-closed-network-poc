import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IdentityTrackingSection } from "./IdentityTrackingSection";

const identityMocks = vi.hoisted(() => ({
  activateCustomerIdentity: vi.fn(async () => ({
    customerId: "123e4567-e89b-42d3-a456-426614174000",
    pseudonymousId: "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH",
  })),
  clearCustomerIdentity: vi.fn(),
}));
vi.mock("./identityApi", () => identityMocks);

describe("IdentityTrackingSection", () => {
  it("원본 고객 ID를 노출하고 Issues, Replays, Traces 조회 링크를 만든다", async () => {
    const user = userEvent.setup();
    render(<IdentityTrackingSection />);
    await user.click(screen.getByRole("button", { name: "고객 ID 연결" }));

    expect(await screen.findByText("123e4567-e89b-42d3-a456-426614174000")).toBeTruthy();
    expect(await screen.findByText("dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Replays" }).getAttribute("href"))
      .toContain("user.id%3A123e4567-e89b-42d3-a456-426614174000");
  });
});
