import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ServiceErrorExplorer } from "./ServiceErrorExplorer";

describe("ServiceErrorExplorer", () => {
  it("선택한 서비스로 Issues, Logs, Traces 링크를 함께 변경한다", async () => {
    const user = userEvent.setup();
    render(<ServiceErrorExplorer />);
    await user.selectOptions(screen.getByLabelText("서비스 선택"), "payment");

    for (const label of ["Issues", "Logs", "Traces"]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href"))
        .toContain("service%3Apayment");
    }
  });
});
