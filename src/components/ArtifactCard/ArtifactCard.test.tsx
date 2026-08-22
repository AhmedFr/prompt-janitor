import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ArtifactCard } from "./ArtifactCard";
import type { ArtifactView } from "@/lib/ipc";

const baseArtifact: ArtifactView = {
  id: 1,
  harness: "claude-code",
  layer: "project",
  kind: "rule",
  name: "no-console-log",
  path: "/repo/.claude/rules/no-console-log.md",
  plugin_name: null,
  description: "Flags leftover console.log statements.",
  bytes: 512,
  grade: "B",
  score: 82,
  file_id: "file-123",
  usage: {
    total: 42,
    sessions: 12,
    last_used: "2026-08-18T12:00:00.000Z",
    error_rate: 0,
    avg_turn_tokens: null,
    count_30d: 5,
    count_prev_30d: 3,
  },
};

describe("ArtifactCard", () => {
  afterEach(cleanup);

  it("renders the kind label, name, description, and grade chip for a graded rule", () => {
    render(<ArtifactCard artifact={baseArtifact} />);
    expect(screen.getByText("Rule")).toBeInTheDocument();
    expect(screen.getByText("no-console-log")).toBeInTheDocument();
    expect(screen.getByText("Flags leftover console.log statements.")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade B")).toBeInTheDocument();
  });

  it("renders the usage badge", () => {
    render(<ArtifactCard artifact={baseArtifact} />);
    expect(screen.getByText(/^used 42×/)).toBeInTheDocument();
  });

  it("is a button and calls onOpen with the file id for a graded rule", () => {
    const onOpen = vi.fn();
    render(<ArtifactCard artifact={baseArtifact} onOpen={onOpen} />);
    const button = screen.getByRole("button");
    button.click();
    expect(onOpen).toHaveBeenCalledWith("file-123");
  });

  it("renders non-rule artifacts as a plain container, not a button", () => {
    const skill: ArtifactView = {
      ...baseArtifact,
      kind: "skill",
      grade: null,
      score: null,
      file_id: null,
    };
    render(<ArtifactCard artifact={skill} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Skill")).toBeInTheDocument();
  });

  it("renders a rule without a file_id as a plain container", () => {
    const rule: ArtifactView = { ...baseArtifact, file_id: null };
    render(<ArtifactCard artifact={rule} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the plugin name as a muted suffix for plugin-layer artifacts", () => {
    const plugin: ArtifactView = {
      ...baseArtifact,
      kind: "plugin",
      layer: "plugin",
      plugin_name: "linear-mcp",
      grade: null,
      file_id: null,
    };
    render(<ArtifactCard artifact={plugin} />);
    expect(screen.getByText("linear-mcp")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ArtifactCard artifact={baseArtifact} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
