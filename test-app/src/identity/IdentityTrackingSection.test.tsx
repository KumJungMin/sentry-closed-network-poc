import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { IdentityTrackingSection } from "./IdentityTrackingSection";

const identityMocks = vi.hoisted(() => ({
  activatePseudonymousIdentity: vi.fn(async () => "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH"),
  clearPseudonymousIdentity: vi.fn(),
}));
vi.mock("./identityApi", () => identityMocks);

describe("IdentityTrackingSection", () => {
  it("가명 ID를 노출하고 Issues, Replays, Traces 조회 링크를 만든다", async () => {
    const user = userEvent.setup();
    render(<IdentityTrackingSection />);
    await user.click(screen.getByRole("button", { name: "가명 ID 연결" }));

    expect(await screen.findByText("dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Replays" }).getAttribute("href"))
      .toContain("user.id%3Adbg_v1_");
  });
});
