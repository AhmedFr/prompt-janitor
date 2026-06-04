import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Sidebar } from "./Sidebar";

describe("Sidebar", () => {
  it("marks the active route with aria-current", () => {
    const { getByRole } = render(
      <Sidebar active="rules" onNavigate={() => {}} onReplay={() => {}} />,
    );
    // The Rules nav item should be the one flagged as the current page.
    expect(getByRole("button", { current: "page" })).toHaveTextContent("Rules");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <Sidebar active="overview" onNavigate={() => {}} onReplay={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
