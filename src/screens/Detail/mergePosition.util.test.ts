import { describe, it, expect } from "vitest";
import type { ArtifactView, ProjectSetup } from "@/lib/ipc";
import {
  globalRuleStack,
  layerForPath,
  projectForPath,
  referenceCandidates,
  referencedArtifacts,
} from "./mergePosition.util";

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "adapt",
  path: "/home/u/.claude/skills/adapt/SKILL.md",
  plugin_name: null,
  description: null,
  bytes: 100,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const project = (o: Partial<ProjectSetup> = {}): ProjectSetup => ({
  harness: "claude_code",
  path: "/repo",
  name: "repo",
  exists: true,
  session_count: 3,
  last_session_at: null,
  artifacts: [],
  ...o,
});

describe("referencedArtifacts", () => {
  it("matches a name used as a whole word", () => {
    const adapt = artifact();
    expect(referencedArtifacts("Use the adapt skill here.", [adapt])).toEqual([adapt]);
  });

  it("matches a command written with its leading slash", () => {
    const ship = artifact({ id: 2, kind: "command", name: "ship", path: "/c/ship.md" });
    expect(referencedArtifacts("Run /ship when done.", [ship])).toEqual([ship]);
  });

  it("does not match a longer word that merely starts with the name", () => {
    expect(referencedArtifacts("adaptive layouts", [artifact()])).toEqual([]);
  });

  it("is case-sensitive — artifact names are invoked verbatim", () => {
    expect(referencedArtifacts("Adapt the design.", [artifact()])).toEqual([]);
  });

  it("treats regex metacharacters in a name as literal text", () => {
    const odd = artifact({ id: 3, name: "c++.helper", path: "/c/odd.md" });
    expect(referencedArtifacts("see c++.helper", [odd])).toEqual([odd]);
    expect(referencedArtifacts("see cXXYhelper", [odd])).toEqual([]);
  });

  it("returns nothing for an unnamed artifact rather than matching everything", () => {
    expect(referencedArtifacts("anything at all", [artifact({ name: "" })])).toEqual([]);
  });
});

describe("referenceCandidates", () => {
  const skill = artifact({ id: 1, kind: "skill", name: "adapt", path: "/g/adapt/SKILL.md" });
  const rule = artifact({ id: 2, kind: "rule", name: "CLAUDE.md", path: "/g/CLAUDE.md" });
  const agent = artifact({ id: 3, kind: "agent", name: "critic", path: "/repo/.claude/critic.md" });

  it("pools the global artifacts with the project's own", () => {
    const found = referenceCandidates([skill], project({ artifacts: [agent] }), "/repo/CLAUDE.md");
    expect(found.map((a) => a.name)).toEqual(["adapt", "critic"]);
  });

  it("drops kinds nothing can invoke by name", () => {
    expect(referenceCandidates([rule], null, "/x")).toEqual([]);
  });

  it("excludes the file's own artifact so it never cites itself", () => {
    expect(referenceCandidates([skill], null, skill.path)).toEqual([]);
  });
});

describe("projectForPath", () => {
  const outer = project({ path: "/repo", name: "repo" });
  const inner = project({ path: "/repo/packages/web", name: "web" });

  it("picks the deepest project containing the file", () => {
    expect(projectForPath("/repo/packages/web/CLAUDE.md", [outer, inner])?.name).toBe("web");
  });

  it("falls back to the enclosing project for a file outside the nested one", () => {
    expect(projectForPath("/repo/docs/CLAUDE.md", [outer, inner])?.name).toBe("repo");
  });

  it("matches the project's own root file", () => {
    expect(projectForPath("/repo", [outer])?.name).toBe("repo");
  });

  it("does not treat a sibling with a shared prefix as a containing project", () => {
    expect(projectForPath("/repository/CLAUDE.md", [outer])).toBeNull();
  });

  it("ignores a trailing slash on the project root", () => {
    expect(projectForPath("/repo/CLAUDE.md", [project({ path: "/repo/" })])?.name).toBe("repo");
  });

  it("returns null when no project owns the file", () => {
    expect(projectForPath("/elsewhere/CLAUDE.md", [outer, inner])).toBeNull();
  });
});

describe("layerForPath", () => {
  const globalRule = artifact({ kind: "rule", name: "CLAUDE.md", path: "/home/u/.claude/CLAUDE.md" });

  it("calls a file that is one of the global rule files global", () => {
    expect(layerForPath("/home/u/.claude/CLAUDE.md", [globalRule])).toBe("global");
  });

  it("calls anything else project", () => {
    expect(layerForPath("/repo/CLAUDE.md", [globalRule])).toBe("project");
  });

  it("does not promote a non-rule global artifact to the global rule layer", () => {
    const skill = artifact({ kind: "skill", path: "/home/u/.claude/skills/adapt/SKILL.md" });
    expect(layerForPath(skill.path, [skill])).toBe("project");
  });
});

describe("globalRuleStack", () => {
  const claudeRule = artifact({ id: 1, kind: "rule", name: "global CLAUDE.md", path: "/u/.claude/CLAUDE.md" });
  const otherHarness = artifact({ id: 2, harness: "cursor", kind: "rule", name: "cursor rules", path: "/u/.cursor/rules" });
  const skill = artifact({ id: 3, kind: "skill", name: "adapt", path: "/u/.claude/skills/adapt/SKILL.md" });

  it("lists the global rules of the file's own harness", () => {
    const stack = globalRuleStack(claudeRule.path, [claudeRule, otherHarness, skill]);
    expect(stack.map((r) => r.name)).toEqual(["global CLAUDE.md"]);
    expect(stack[0]).toMatchObject({ layer: "global", path: claudeRule.path });
  });

  it("is empty for a file the global inventory has never heard of", () => {
    expect(globalRuleStack("/repo/CLAUDE.md", [claudeRule])).toEqual([]);
  });
});
