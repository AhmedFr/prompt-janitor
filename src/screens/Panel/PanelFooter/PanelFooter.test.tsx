import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import type { ScanProgressState } from "@/lib/useScanProgress";
import { PanelFooter } from "./PanelFooter";

const idle: ScanProgressState = { phase: null, progress: null, reset: () => {} };
const running: ScanProgressState = {
  phase: "files",
  progress: { done: 12, total: 40 },
  reset: () => {},
};

const actions = () => ({ onScan: vi.fn(), onOpenApp: vi.fn(), onQuit: vi.fn() });

describe("PanelFooter", () => {
  afterEach(cleanup);

  it("wires the three things the panel can do", () => {
    const handlers = actions();
    render(<PanelFooter scanning={false} scan={idle} {...handlers} />);

    fireEvent.click(screen.getByRole("button", { name: "Scan now" }));
    fireEvent.click(screen.getByRole("button", { name: "Open app" }));
    fireEvent.click(screen.getByRole("button", { name: "Quit" }));

    expect(handlers.onScan).toHaveBeenCalled();
    expect(handlers.onOpenApp).toHaveBeenCalled();
    expect(handlers.onQuit).toHaveBeenCalled();
  });

  /** A long scan and a hang look identical when the button only greys out. */
  it("narrates a running scan and locks the button", () => {
    render(<PanelFooter scanning scan={running} {...actions()} />);
    expect(screen.getByRole("button", { name: "Scanning…" })).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Scan progress" })).toBeInTheDocument();
    expect(screen.getByText("Grading 12/40 files")).toBeInTheDocument();
  });

  it("hides the bar when no scan is running", () => {
    render(<PanelFooter scanning={false} scan={idle} {...actions()} />);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
