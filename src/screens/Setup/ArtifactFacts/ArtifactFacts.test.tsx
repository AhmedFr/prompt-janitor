import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactView } from "@/lib/ipc";
import { ArtifactFacts } from "./index";

afterEach(cleanup);

const agent: ArtifactView = {
  id: 3,
  harness: "claude_code",
  layer: "project",
  kind: "agent",
  name: "reviewer",
  path: "/code/app/.claude/agents/reviewer.md",
  plugin_name: null,
  description: "Reviews diffs before a PR opens",
  bytes: 200,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
};

describe("ArtifactFacts", () => {
  it("lists each fact as a term and its value", () => {
    const { container } = render(<ArtifactFacts artifact={agent} scope="app" />);
    const terms = [...container.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(terms).toEqual(["Kind", "Scope", "Description", "Last used"]);
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("app")).toBeInTheDocument();
    expect(screen.getByText("Reviews diffs before a PR opens")).toBeInTheDocument();
  });

  it("can leave the description to the file", () => {
    render(<ArtifactFacts artifact={agent} scope="app" showDescription={false} />);
    expect(screen.queryByText("Reviews diffs before a PR opens")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ArtifactFacts artifact={agent} scope="app" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
