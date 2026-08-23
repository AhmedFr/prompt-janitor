import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ScanBar } from "./ScanBar";

afterEach(cleanup);

describe("ScanBar", () => {
  it("shows the status line it was given", () => {
    render(<ScanBar progress={{ done: 3, total: 12 }} status="Grading 3/12 files" />);
    expect(screen.getByText("Grading 3/12 files")).toBeInTheDocument();
  });

  it("fills the bar to the share of files graded so far", () => {
    const { container } = render(<ScanBar progress={{ done: 3, total: 12 }} status="…" />);
    expect(container.querySelector<HTMLElement>(".scan-bar__fill")?.style.width).toBe("25%");
  });

  it("draws a stub rather than an empty bar before the first counter arrives", () => {
    const { container } = render(<ScanBar progress={null} status="Looking around…" />);
    // A scan with no counter yet is still running; a 0%-wide bar reads as a hang.
    expect(container.querySelector<HTMLElement>(".scan-bar__fill")?.style.width).toBe("8%");
  });

  it("announces progress to assistive tech as a progressbar", () => {
    render(<ScanBar progress={{ done: 3, total: 12 }} status="Grading 3/12 files" />);
    const bar = screen.getByRole("progressbar", { name: "Scan progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "25");
  });

  it("leaves the value off while the total is unknown", () => {
    render(<ScanBar progress={null} status="Looking around…" />);
    expect(screen.getByRole("progressbar", { name: "Scan progress" })).not.toHaveAttribute(
      "aria-valuenow",
    );
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ScanBar progress={{ done: 1, total: 4 }} status="Grading" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
