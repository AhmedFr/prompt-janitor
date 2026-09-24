import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import {
  ActionsCell,
  CountCell,
  GradeCell,
  LastUsedCell,
  NameCell,
  PathCell,
  PercentCell,
  ScopeCell,
  TokensCell,
} from "./index";
import { lastUsedAt, truncateMiddle } from "./cells.util";

/** `relativeTime` reads the wall clock, so every relative assertion pins it. */
const NOW = new Date("2026-08-19T15:00:00.000Z");

/**
 * Only the relative-age assertions freeze the clock. Fake timers would stall
 * axe's own async work, so the accessibility sweep at the bottom of this file
 * has to run on the real one.
 */
function withFrozenClock() {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());
}

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

describe("NameCell", () => {
  it("renders the name with its description muted beside it", () => {
    render(<NameCell name="superpowers" description="v6.3.0 · claude-plugins-official" />);
    expect(screen.getByText("superpowers")).toBeInTheDocument();
    expect(screen.getByText("v6.3.0 · claude-plugins-official")).toHaveClass("muted");
  });

  it("defaults the name's hover text to the name itself", () => {
    render(<NameCell name="superpowers" />);
    expect(screen.getByText("superpowers")).toHaveAttribute("title", "superpowers");
  });

  it("takes an explicit title, for a cell whose description is shown elsewhere", () => {
    render(<NameCell name="adapt" title="adapt — Adapts designs across screen sizes" />);
    expect(screen.getByText("adapt")).toHaveAttribute(
      "title",
      "adapt — Adapts designs across screen sizes",
    );
  });

  it("renders nothing beside the name when there is no description", () => {
    const { container } = render(<NameCell name="deploy" description={null} />);
    expect(container.querySelector(".dt-name__desc")).toBeNull();
  });

  it("keeps the full text in a title, because both halves are clamped to one line", () => {
    const description = "a description far too long to survive one compact table row";
    render(<NameCell name="running-a-feature-workflow" description={description} />);
    expect(screen.getByTitle("running-a-feature-workflow")).toBeInTheDocument();
    expect(screen.getByTitle(description)).toBeInTheDocument();
  });
});

describe("CountCell", () => {
  it("groups thousands so a long count stays scannable", () => {
    render(<CountCell value={12345} />);
    expect(screen.getByText("12,345")).toBeInTheDocument();
  });

  it("renders a real zero rather than an em dash", () => {
    render(<CountCell value={0} />);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders an em dash when the count is unknown", () => {
    render(<CountCell value={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});

describe("lastUsedAt", () => {
  it("parses an RFC3339 timestamp to epoch milliseconds", () => {
    expect(lastUsedAt("2026-08-19T10:00:00.000Z")).toBe(Date.parse("2026-08-19T10:00:00.000Z"));
  });

  it("reads a missing or unparseable timestamp as never used", () => {
    expect(lastUsedAt(null)).toBeNull();
    expect(lastUsedAt(undefined)).toBeNull();
    expect(lastUsedAt("not a date")).toBeNull();
  });
});

describe("LastUsedCell", () => {
  withFrozenClock();

  it("renders a short relative age", () => {
    render(<LastUsedCell lastUsed="2026-08-19T10:00:00.000Z" />);
    expect(screen.getByText("5h")).toBeInTheDocument();
  });

  it("counts days once the age passes a day", () => {
    render(<LastUsedCell lastUsed="2026-08-16T15:00:00.000Z" />);
    expect(screen.getByText("3d")).toBeInTheDocument();
  });

  it("says never — not an em dash — for an artifact nothing ever invoked", () => {
    // The em dash means "unknown" in every other cell; "was never called" is
    // a fact about the artifact, not a gap in the data.
    render(<LastUsedCell lastUsed={null} />);
    expect(screen.getByText("never")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
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
});

describe("cells accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(
      <div>
        <GradeCell grade="A" />
        <CountCell value={9} />
        <LastUsedCell lastUsed="2026-08-19T10:00:00.000Z" />
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
