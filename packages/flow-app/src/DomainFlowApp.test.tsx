// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainFlowApp } from "./DomainFlowApp.js";
import type { DomainFlowAppProps } from "./types.js";

const membershipProps: DomainFlowAppProps = {
  flowName: "membership",
  appTitle: "가입 서비스",
  accentColor: "#2457d6",
  userId: "CUSTOMER-001",
  stepContent: {
    terms: {
      title: "약관에 동의해 주세요",
      description: "필수 약관 확인",
      field: { name: "terms", label: "필수 약관", type: "checkbox", required: true },
    },
    account: { title: "계정 정보", description: "이메일 입력" },
    phone: { title: "휴대폰 인증", description: "휴대폰 입력" },
    identity: { title: "본인 확인", description: "고객 확인" },
    result: { title: "가입 완료", description: "가입이 완료됨" },
  },
};

describe("공통 도메인 플로우 화면", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("필수 입력을 검증하고 성공하면 다음 URL 화면으로 이동한다", async () => {
    const user = userEvent.setup();
    const onFlowEvent = vi.fn();
    render(
      <MemoryRouter initialEntries={["/signup/terms"]}>
        <DomainFlowApp {...membershipProps} onFlowEvent={onFlowEvent} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("alert").textContent).toContain("필수 약관 항목을 확인해 주세요.");
    expect(onFlowEvent).toHaveBeenCalledWith(expect.objectContaining({ event: "step_validation_failed" }));

    await user.click(screen.getByRole("checkbox", { name: "필수 약관" }));
    await user.click(screen.getByRole("button", { name: "다음" }));
    expect(screen.getByRole("heading", { name: "계정 정보" })).toBeTruthy();
  });

  it("중간 단계 URL을 직접 열어도 해당 화면을 표시한다", () => {
    render(
      <MemoryRouter initialEntries={["/signup/phone"]}>
        <DomainFlowApp {...membershipProps} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "휴대폰 인증" })).toBeTruthy();
    expect(screen.getByText("단계 3 / 5")).toBeTruthy();
  });
});
