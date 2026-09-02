import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyAccessSection } from "./PrivacyAccessSection";

const apiMocks = vi.hoisted(() => ({
  requestPrivacyChallenge: vi.fn(async () => ({ challengeId: "challenge", oneTimeCode: "123456", expiresAt: "future", pocSyntheticDataOnly: true })),
  verifyPrivacyChallenge: vi.fn(async () => ({ sessionToken: "session", expiresAt: "future" })),
  fetchPrivateProfile: vi.fn(async () => ({
    pseudonymousId: "dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH",
    synthetic: true,
    source: "synthetic-poc-adapter",
    name: "합성 고객 홍길동",
    phone: "010-0000-1234",
    account: "000-0000-0000-01",
    cddStatus: "VERIFIED",
  })),
  revokePrivacySession: vi.fn(),
}));
vi.mock("./privacyApi", () => apiMocks);

describe("PrivacyAccessSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("가명 ID 없이는 조회 요청을 막는다", () => {
    render(<PrivacyAccessSection pseudonymousId="" />);
    expect(screen.getByRole("button", { name: "조회 승인 요청" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("개인정보 OFF")).toBeTruthy();
  });

  it("일회용 코드 검증 후 합성 개인정보를 열고 즉시 닫는다", async () => {
    const user = userEvent.setup();
    render(<PrivacyAccessSection pseudonymousId="dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH" />);
    await user.click(screen.getByRole("button", { name: "조회 승인 요청" }));
    await user.click(screen.getByRole("button", { name: "10분 조회 열기" }));
    expect(await screen.findByText("개인정보 ON · 합성 데이터")).toBeTruthy();
    expect(screen.getByText("합성 고객 홍길동")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "즉시 조회 종료" }));
    expect(apiMocks.revokePrivacySession).toHaveBeenCalledWith("session");
    expect(screen.getByText("개인정보 OFF")).toBeTruthy();
  });

  it("사용자 전환으로 화면이 해제되면 열린 JIT 세션도 폐기한다", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PrivacyAccessSection pseudonymousId="dbg_v1_R2Z4s9QmT6xK1pW8nB3cD5fH" />,
    );
    await user.click(screen.getByRole("button", { name: "조회 승인 요청" }));
    await user.click(screen.getByRole("button", { name: "10분 조회 열기" }));
    await screen.findByText("개인정보 ON · 합성 데이터");
    unmount();
    expect(apiMocks.revokePrivacySession).toHaveBeenCalledWith("session");
  });
});
