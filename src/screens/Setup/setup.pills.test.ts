import { describe, it, expect } from "vitest";
import type { ArtifactKind, ArtifactView, UsageStat } from "@/lib/ipc";
import { pillsFor } from "./setup.pills";

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 5,
  sessions: 2,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 1,
  count_prev_30d: 1,
  ...o,
});

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
  usage: null,
  ...o,
});

const PROJECT_NAMES = new Map([
  ["/code/acme-api", "acme-api"],
  ["/code/widgets", "widgets"],
]);

describe("pillsFor: scope group", () => {
  it("builds one Scope option per project present in rows, plus Global, and no others", () => {
    const rows = [
      artifact({ id: 1, layer: "global" }),
      artifact({ id: 2, layer: "project", path: "/code/acme-api/.claude/skills/deploy/SKILL.md" }),
      // "widgets" is a known project but nothing in `rows` belongs to it — it
      // must not show up as an option nobody could ever match.
    ];
    const [scope] = pillsFor("skill", rows, null, PROJECT_NAMES);
    expect(scope.id).toBe("scope");
    expect(scope.options.map((o) => o.label)).toEqual(["Global", "acme-api"]);
  });

  it("matches only the row's own layer/project — Global excludes project rows and vice versa", () => {
    const global = artifact({ id: 1, layer: "global" });
    const project = artifact({
      id: 2,
      layer: "project",
      path: "/code/acme-api/.claude/skills/deploy/SKILL.md",
    });
    const [scope] = pillsFor("skill", [global, project], null, PROJECT_NAMES);
    const globalOpt = scope.options.find((o) => o.label === "Global")!;
    const acmeOpt = scope.options.find((o) => o.label === "acme-api")!;
    expect(globalOpt.predicate(global)).toBe(true);
    expect(globalOpt.predicate(project)).toBe(false);
    expect(acmeOpt.predicate(project)).toBe(true);
    expect(acmeOpt.predicate(global)).toBe(false);
  });

  it("has no Scope group for the plugin kind", () => {
    const groups = pillsFor("plugin", [artifact({ kind: "plugin" })], null, PROJECT_NAMES);
    expect(groups.find((g) => g.id === "scope")).toBeUndefined();
  });
});

describe("pillsFor: status group (never used / errors / high cost)", () => {
  const never = artifact({ id: 1, usage: null });
  const erroring = artifact({ id: 2, usage: usage({ error_rate: 0.4 }) });
  const okErrorRate = artifact({ id: 3, usage: usage({ error_rate: 0.1 }) });
  const pricey = artifact({ id: 4, usage: usage({ avg_turn_tokens: 4000 }) });
  const cheap = artifact({ id: 5, usage: usage({ avg_turn_tokens: 100 }) });
  const rows = [never, erroring, okErrorRate, pricey, cheap];

  it("is present for usage-tracked kinds (skill/agent/command/mcp_server)", () => {
    for (const kind of ["skill", "agent", "command", "mcp_server"] as ArtifactKind[]) {
      const groups = pillsFor(kind, rows, 1000, PROJECT_NAMES);
      expect(groups.find((g) => g.id === "status")).toBeDefined();
    }
  });

  it("is absent for rule, hook and plugin — kinds with no Uses column", () => {
    for (const kind of ["rule", "hook", "plugin"] as ArtifactKind[]) {
      const groups = pillsFor(kind, rows, 1000, PROJECT_NAMES);
      expect(groups.find((g) => g.id === "status")).toBeUndefined();
    }
  });

  it("flags never-used rows correctly", () => {
    const status = pillsFor("skill", rows, 1000, PROJECT_NAMES).find((g) => g.id === "status")!;
    const neverOpt = status.options.find((o) => o.id === "never")!;
    expect(rows.filter(neverOpt.predicate)).toEqual([never]);
  });

  it("flags rows at or above the shared error-rate threshold (25%)", () => {
    const status = pillsFor("skill", rows, 1000, PROJECT_NAMES).find((g) => g.id === "status")!;
    const errorsOpt = status.options.find((o) => o.id === "errors")!;
    expect(rows.filter(errorsOpt.predicate)).toEqual([erroring]);
    expect(errorsOpt.predicate(okErrorRate)).toBe(false);
  });

  it("flags rows at or above the caller-supplied cost bar", () => {
    const status = pillsFor("skill", rows, 1000, PROJECT_NAMES).find((g) => g.id === "status")!;
    const costOpt = status.options.find((o) => o.id === "cost")!;
    expect(rows.filter(costOpt.predicate)).toEqual([pricey]);
    expect(costOpt.predicate(cheap)).toBe(false);
  });

  it("matches nothing for high cost when the cost bar is null", () => {
    const status = pillsFor("skill", rows, null, PROJECT_NAMES).find((g) => g.id === "status")!;
    const costOpt = status.options.find((o) => o.id === "cost")!;
    expect(rows.filter(costOpt.predicate)).toEqual([]);
  });

  it("ships precomputed counts (reusing setup.util's filterCounts) rather than leaving them for faceting", () => {
    const status = pillsFor("skill", rows, 1000, PROJECT_NAMES).find((g) => g.id === "status")!;
    const counts = Object.fromEntries(status.options.map((o) => [o.id, o.count]));
    expect(counts).toEqual({ never: 1, errors: 1, cost: 1 });
  });
});

describe("pillsFor: plugin-bundled group", () => {
  it("is present for skill/agent/command — the kinds a plugin can bundle", () => {
    for (const kind of ["skill", "agent", "command"] as ArtifactKind[]) {
      const groups = pillsFor(kind, [], null, PROJECT_NAMES);
      expect(groups.find((g) => g.id === "bundled")).toBeDefined();
    }
  });

  it("is absent for rule, hook, mcp_server and plugin", () => {
    for (const kind of ["rule", "hook", "mcp_server", "plugin"] as ArtifactKind[]) {
      const groups = pillsFor(kind, [], null, PROJECT_NAMES);
      expect(groups.find((g) => g.id === "bundled")).toBeUndefined();
    }
  });

  it("matches rows bundled by an installed plugin (layer plugin) and only those", () => {
    const bundled = artifact({ id: 1, layer: "plugin", plugin_name: "superpowers" });
    const own = artifact({ id: 2, layer: "global" });
    const [group] = pillsFor("skill", [bundled, own], null, PROJECT_NAMES).filter((g) => g.id === "bundled");
    const option = group.options[0];
    expect(option.predicate(bundled)).toBe(true);
    expect(option.predicate(own)).toBe(false);
  });
});

describe("pillsFor: plugin kind has no groups at all", () => {
  it("returns an empty array — no Scope, Status or Plugin-bundled group applies", () => {
    expect(pillsFor("plugin", [artifact({ kind: "plugin" })], null, PROJECT_NAMES)).toEqual([]);
  });
});

describe("pillsFor: identity stability", () => {
  it("returns the same array reference for the same rows/projectNames/kind/costBar", () => {
    const rows = [artifact({ id: 1 })];
    expect(pillsFor("skill", rows, 1000, PROJECT_NAMES)).toBe(pillsFor("skill", rows, 1000, PROJECT_NAMES));
  });

  it("returns a different reference when rows is a different array (even with equal contents)", () => {
    const a = pillsFor("skill", [artifact({ id: 1 })], 1000, PROJECT_NAMES);
    const b = pillsFor("skill", [artifact({ id: 1 })], 1000, PROJECT_NAMES);
    expect(a).not.toBe(b);
  });

  it("returns a different reference when projectNames is a different Map", () => {
    const rows = [artifact({ id: 1 })];
    const a = pillsFor("skill", rows, 1000, new Map());
    const b = pillsFor("skill", rows, 1000, new Map());
    expect(a).not.toBe(b);
  });

  it("returns a different reference for a different kind or a different costBar, same rows/projectNames", () => {
    const rows = [artifact({ id: 1 })];
    const forSkill = pillsFor("skill", rows, 1000, PROJECT_NAMES);
    expect(pillsFor("agent", rows, 1000, PROJECT_NAMES)).not.toBe(forSkill);
    expect(pillsFor("skill", rows, 2000, PROJECT_NAMES)).not.toBe(forSkill);
  });
});
