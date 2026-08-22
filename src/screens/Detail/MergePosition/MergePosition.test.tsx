import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactView, EffectiveRule } from "@/lib/ipc";
import { MergePosition } from "./MergePosition";
import type { MergePositionData } from "./MergePosition.types";

const NOW = new Date("2026-08-21T12:00:00Z");

const rule = (o: Partial<EffectiveRule> = {}): EffectiveRule => ({
  layer: "global",
  path: "/home/u/.claude/CLAUDE.md",
  name: "global CLAUDE.md",
  grade: "B",
  file_id: "f-global",
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "adapt",
  path: "/home/u/.claude/skills/adapt/SKILL.md",
  plugin_name: null,
  description: null,
  bytes: 120,
  grade: null,
  score: null,
  file_id: null,
  usage: {
    total: 42,
    sessions: 12,
    last_used: "2026-08-18T12:00:00.000Z",
    error_rate: 0,
    avg_turn_tokens: null,
    count_30d: 5,
    count_prev_30d: 3,
  },
  ...o,
});

const data = (o: Partial<MergePositionData> = {}): MergePositionData => ({
  layer: "project",
  project: { name: "repo", path: "/repo" },
  filePath: "/repo/CLAUDE.md",
  effective: [rule(), rule({ layer: "project", path: "/repo/CLAUDE.md", name: "repo CLAUDE.md", file_id: "f1" })],
  referenced: [artifact()],
  ...o,
});

afterEach(cleanup);

describe("MergePosition", () => {
  it("says where a project file lands in the merge order", () => {
    render(<MergePosition state={data()} now={NOW} />);
    expect(screen.getByText("Project rules — loaded after global")).toBeInTheDocument();
  });

  it("says a global file loads everywhere", () => {
    render(
      <MergePosition
        state={data({ layer: "global", project: null, filePath: "/home/u/.claude/CLAUDE.md" })}
        now={NOW}
      />,
    );
    expect(screen.getByText("Global rules — loaded in every project")).toBeInTheDocument();
  });

  it("lists the whole effective stack with its grades", () => {
    render(<MergePosition state={data()} now={NOW} />);
    expect(screen.getByText("global CLAUDE.md")).toBeInTheDocument();
    expect(screen.getByText("repo CLAUDE.md")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Grade B")).toHaveLength(2);
  });

  it("says 'ungraded' in words rather than showing an F-shaped chip", () => {
    render(<MergePosition state={data({ effective: [rule({ grade: null })] })} now={NOW} />);
    expect(screen.getByText("ungraded")).toBeInTheDocument();
    expect(screen.queryByText("F")).not.toBeInTheDocument();
  });

  it("marks the viewed file's own rung of the stack", () => {
    render(<MergePosition state={data()} now={NOW} />);
    expect(screen.getByText("this file")).toBeInTheDocument();
  });

  it("lists referenced artifacts with their usage evidence", () => {
    render(<MergePosition state={data()} now={NOW} />);
    expect(screen.getByText("adapt")).toBeInTheDocument();
    expect(screen.getByText("Skill")).toBeInTheDocument();
    expect(screen.getByText(/12 sessions/)).toBeInTheDocument();
  });

  it("names what is missing when the file references nothing", () => {
    render(<MergePosition state={data({ referenced: [] })} now={NOW} />);
    expect(
      screen.getByText("No skills, agents or MCP servers referenced by name"),
    ).toBeInTheDocument();
  });

  it("says so when no rule file applies", () => {
    render(<MergePosition state={data({ effective: [] })} now={NOW} />);
    expect(screen.getByText("No rule files apply here.")).toBeInTheDocument();
  });

  it("degrades to one muted line when the setup could not be read", () => {
    render(<MergePosition state="error" now={NOW} />);
    expect(screen.getByText("Setup not available")).toBeInTheDocument();
    expect(screen.queryByText(/loaded/)).not.toBeInTheDocument();
  });

  it("renders nothing at all while the setup is still loading", () => {
    const { container } = render(<MergePosition state={null} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MergePosition state={data()} now={NOW} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
