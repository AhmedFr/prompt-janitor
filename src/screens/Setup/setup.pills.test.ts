import { describe, it, expect } from "vitest";
import type { ArtifactView } from "@/lib/ipc";
import { scopePillsFor } from "./setup.pills";
import type { SetupRow } from "./setupRows.util";

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "a",
  path: "/a.md",
  plugin_name: null,
  description: null,
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  issue_count: null,
  worst_severity: null,
  usage: null,
  ...o,
});

const PROJECT_NAMES = new Map([
  ["/code/acme-api", "acme-api"],
  ["/code/widgets", "widgets"],
]);

describe("scopePillsFor: one Scope group over every kind", () => {
  const row = (o: Partial<SetupRow>): SetupRow => ({
    ...artifact(o),
    origin: "inventory",
    project_label: null,
    project_path: null,
    load_order: null,
    ...o,
  });

  it("offers Global, each project and each plugin present across mixed kinds", () => {
    const rows = [
      row({ id: 1, kind: "rule", layer: "global" }),
      row({ id: 2, kind: "hook", layer: "project", path: "/code/widgets/.claude/settings.json" }),
      row({ id: 3, kind: "skill", layer: "plugin", plugin_name: "superpowers" }),
    ];
    const groups = scopePillsFor(rows, PROJECT_NAMES);
    expect(groups.map((g) => g.id)).toEqual(["scope"]);
    expect(groups[0].options.map((o) => o.label)).toEqual(["Global", "widgets", "superpowers"]);
  });

  it("builds its options from scoped kinds only — a plugin manifest row adds no option", () => {
    const rows = [row({ id: 1, kind: "rule" }), row({ id: 2, kind: "plugin", layer: "plugin", plugin_name: "posthog" })];
    expect(scopePillsFor(rows, PROJECT_NAMES)[0].options.map((o) => o.label)).toEqual(["Global"]);
  });

  it("offers a graded-only row's project, one the inventory never knew, and keeps the row when it is picked", () => {
    const graded = row({
      id: -7,
      kind: "rule",
      layer: "project",
      name: "AGENTS.md",
      path: "/code/side/AGENTS.md",
      origin: "graded",
      project_label: "side",
      project_path: "/code/side",
    });
    const rows = [row({ id: 1, kind: "rule", layer: "global" }), graded];
    const [scope] = scopePillsFor(rows, PROJECT_NAMES);
    const side = scope.options.find((o) => o.label === "side");
    expect(scope.options.map((o) => o.label)).toEqual(["Global", "side"]);
    expect(side?.predicate(graded)).toBe(true);
    expect(side?.predicate(rows[0])).toBe(false);
  });

  it("offers no Scope group when no row in the slice has a scope", () => {
    const rows = [row({ id: 1, kind: "plugin", layer: "plugin", plugin_name: "posthog" })];
    expect(scopePillsFor(rows, PROJECT_NAMES)).toEqual([]);
  });
});
