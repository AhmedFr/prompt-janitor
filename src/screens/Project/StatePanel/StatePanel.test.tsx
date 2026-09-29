import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { StatePanel } from "./StatePanel";

afterEach(cleanup);

describe("StatePanel", () => {
  it("says which state it is and offers the way back", () => {
    const onBack = vi.fn();
    render(<StatePanel title="Project not found" body="No scanned project sits here." onBack={onBack} />);

    expect(screen.getByRole("heading", { name: "Project not found" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Projects" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("offers no retry where retrying is not a real option", () => {
    render(<StatePanel title="No project selected" body="Pick one." onBack={vi.fn()} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("fires the retry it was given, alongside the way back", () => {
    const onClick = vi.fn();
    render(
      <StatePanel
        title="Project could not be read"
        body="The query failed."
        onBack={vi.fn()}
        retry={{ label: "Try again", onClick }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Back to Projects" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <StatePanel title="t" body="b" onBack={vi.fn()} retry={{ label: "Try again", onClick: vi.fn() }} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
