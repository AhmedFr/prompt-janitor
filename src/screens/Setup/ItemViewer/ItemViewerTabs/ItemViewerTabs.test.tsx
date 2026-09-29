import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ItemViewerTabs } from "./ItemViewerTabs";

afterEach(cleanup);

describe("ItemViewerTabs", () => {
  it("is a tablist named Viewer with Content, Findings and Usage", () => {
    render(<ItemViewerTabs active="content" onChange={vi.fn()} findingsCount={null} />);
    const list = screen.getByRole("tablist", { name: "Viewer" });
    expect(list).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Content", "Findings", "Usage"]);
    expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute("aria-selected", "true");
  });

  it("counts open findings on the Findings tab", () => {
    render(<ItemViewerTabs active="content" onChange={vi.fn()} findingsCount={4} />);
    expect(screen.getByRole("tab", { name: /Findings/ })).toHaveTextContent("Findings4");
  });

  it("shows no count when there is nothing open", () => {
    render(<ItemViewerTabs active="content" onChange={vi.fn()} findingsCount={0} />);
    expect(screen.getByRole("tab", { name: /Findings/ })).toHaveTextContent(/^Findings$/);
  });

  it("holds Findings and Usage while the Content tab has a draft open", () => {
    const onChange = vi.fn();
    render(<ItemViewerTabs active="content" onChange={onChange} findingsCount={2} editing />);
    expect(screen.getByRole("tab", { name: "Content" })).toBeEnabled();
    expect(screen.getByRole("tab", { name: /Findings/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Usage" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Usage" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports a tab pick", () => {
    const onChange = vi.fn();
    render(<ItemViewerTabs active="content" onChange={onChange} findingsCount={null} />);
    fireEvent.click(screen.getByRole("tab", { name: "Usage" }));
    expect(onChange).toHaveBeenCalledWith("usage");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ItemViewerTabs active="findings" onChange={vi.fn()} findingsCount={2} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
