import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { UsageStat } from "@/lib/ipc";
import {
  ActionsCell,
  GradeCell,
  PathCell,
  PercentCell,
  ScopeCell,
  TokensCell,
  UsageCell,
} from "./index";
import { truncateMiddle } from "./cells.util";

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 9,
  sessions: 4,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 2,
  count_prev_30d: 1,
  ...o,
});

afterEach(cleanup);

describe("GradeCell", () => {
  it("renders the letter grade", () => {
    render(<GradeCell grade="B" />);
    expect(screen.getByLabelText("Grade B")).toHaveTextContent("B");
  });

  it("renders the neutral ungraded chip for a null grade", () => {
    render(<GradeCell grade={null} />);
    expect(screen.getByLabelText("Ungraded")).toBeInTheDocument();
  });
});

describe("UsageCell", () => {
  it("renders the label formatUsage produced", () => {
    render(<UsageCell usage={usage()} now={new Date("2026-08-19T15:00:00.000Z")} />);
    expect(screen.getByText("used 9× · 4 sessions · last 5h ago")).toBeInTheDocument();
  });

  it("carries the usage tone so never-used rows read differently", () => {
    render(<UsageCell usage={null} />);
    expect(screen.getByText("never used")).toHaveAttribute("data-tone", "never");
  });
});

describe("PercentCell", () => {
  it("renders a 0–1 fraction as a whole percentage", () => {
    render(<PercentCell value={0.421} />);
    expect(screen.getByText("42%")).toBeInTheDocument();
  });

  it("renders an em dash when the value is unknown", () => {
    render(<PercentCell value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("TokensCell", () => {
  it("groups thousands so long token counts stay scannable", () => {
    render(<TokensCell value={1234567} />);
    expect(screen.getByText("1,234,567")).toBeInTheDocument();
  });

  it("renders an em dash when the value is unknown", () => {
    render(<TokensCell value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("ScopeCell", () => {
  it("labels the global layer", () => {
    render(<ScopeCell layer="global" />);
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("names the project for a project-layer row", () => {
    render(<ScopeCell layer="project" projectName="acme-api" />);
    expect(screen.getByText("acme-api")).toBeInTheDocument();
  });

  it("falls back to a generic project label when the name is missing", () => {
    render(<ScopeCell layer="project" projectName={null} />);
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("names the plugin a bundled row was installed by", () => {
    // "Plugin" alone answers the wrong question: every bundled row in the
    // table is a plugin row, and which plugin put it there is the provenance
    // the column exists for.
    render(<ScopeCell layer="plugin" pluginName="posthog" />);
    expect(screen.getByText("posthog")).toBeInTheDocument();
  });

  it("falls back to a generic plugin label when the plugin name is missing", () => {
    render(<ScopeCell layer="plugin" pluginName={null} />);
    expect(screen.getByText("Plugin")).toBeInTheDocument();
  });
});

describe("truncateMiddle", () => {
  it("leaves a short path alone", () => {
    expect(truncateMiddle("/a/b/c.md")).toBe("/a/b/c.md");
  });

  it("keeps the head and the tail of a long path", () => {
    const path = `/Users/someone/${"deep/".repeat(20)}rules/web.md`;
    const out = truncateMiddle(path);
    expect(out).toContain("…");
    expect(out.startsWith(path.slice(0, 24))).toBe(true);
    expect(out.endsWith(path.slice(-32))).toBe(true);
    expect(out).toHaveLength(24 + 1 + 32);
  });
});

describe("PathCell", () => {
  it("middle-truncates a long path but keeps the whole one in the title", () => {
    const path = `/Users/someone/${"deep/".repeat(20)}rules/web.md`;
    render(<PathCell path={path} />);
    const node = screen.getByTitle(path);
    expect(node).toHaveTextContent("…");
    expect(node.textContent).not.toBe(path);
  });

  it("renders a short path verbatim", () => {
    render(<PathCell path="/a/b/c.md" />);
    expect(screen.getByTitle("/a/b/c.md")).toHaveTextContent("/a/b/c.md");
  });
});

describe("ActionsCell", () => {
  it("gives every icon button an accessible name", () => {
    render(<ActionsCell actions={[{ label: "Edit rule", icon: "wand", onClick: vi.fn() }]} />);
    expect(screen.getByRole("button", { name: "Edit rule" })).toBeInTheDocument();
  });

  it("calls the action handler on click", () => {
    const onClick = vi.fn();
    render(<ActionsCell actions={[{ label: "Delete", icon: "x", onClick }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not bubble the click up to a clickable row", () => {
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <ActionsCell actions={[{ label: "Delete", icon: "x", onClick: vi.fn() }]} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("disables an action there is nothing to do, and never fires it", () => {
    const onClick = vi.fn();
    render(<ActionsCell actions={[{ label: "Copy pattern", icon: "layers", onClick, disabled: true }]} />);
    const button = screen.getByRole("button", { name: "Copy pattern" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("cells accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <div>
        <GradeCell grade="A" />
        <UsageCell usage={usage()} now={new Date("2026-08-19T15:00:00.000Z")} />
        <PercentCell value={0.5} />
        <TokensCell value={2400} />
        <ScopeCell layer="global" />
        <PathCell path="/Users/someone/.claude/rules/web.md" />
        <ActionsCell actions={[{ label: "Edit", icon: "wand", onClick: vi.fn() }]} />
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
