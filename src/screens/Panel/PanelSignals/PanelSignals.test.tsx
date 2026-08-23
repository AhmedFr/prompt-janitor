import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { PanelSignals } from "./PanelSignals";

const counts = { neverUsedSkills: 3, mcpErroring: 1, sessionsToday: 12 };

describe("PanelSignals", () => {
  afterEach(cleanup);

  it("agrees each count with its noun and says where the chip leads", () => {
    render(<PanelSignals {...counts} onOpen={() => {}} />);
    expect(
      screen.getByRole("button", { name: "3 never-used skills — open Setup" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "1 MCP server erroring — open Setup" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "12 sessions today — open Analytics" }),
    ).toBeInTheDocument();
  });

  it("sends each chip to the screen where its signal is dealt with", () => {
    const onOpen = vi.fn();
    render(<PanelSignals {...counts} onOpen={onOpen} />);

    fireEvent.click(screen.getByRole("button", { name: "3 never-used skills — open Setup" }));
    expect(onOpen).toHaveBeenCalledWith("setup", "skill");

    fireEvent.click(screen.getByRole("button", { name: "1 MCP server erroring — open Setup" }));
    expect(onOpen).toHaveBeenCalledWith("setup", "mcp_server");

    fireEvent.click(screen.getByRole("button", { name: "12 sessions today — open Analytics" }));
    expect(onOpen).toHaveBeenCalledWith("analytics", null);
  });

  /** Sessions are neither good nor bad; painting them red would invent a verdict. */
  it("tones the problem chips only", () => {
    render(<PanelSignals {...counts} onOpen={() => {}} />);
    expect(screen.getByText("3 never-used skills")).toHaveAttribute("data-tone", "error");
    expect(screen.getByText("1 MCP server erroring")).toHaveAttribute("data-tone", "error");
    expect(screen.getByText("12 sessions today")).toHaveAttribute("data-tone", "ok");
  });

  it("goes quiet when every count is zero", () => {
    render(<PanelSignals neverUsedSkills={0} mcpErroring={0} sessionsToday={0} onOpen={() => {}} />);
    expect(screen.getByText("0 never-used skills")).toHaveAttribute("data-tone", "ok");
  });
});
