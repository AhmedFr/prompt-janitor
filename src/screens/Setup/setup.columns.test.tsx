import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import type { ArtifactKind, ArtifactView, UsageStat } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import {
  actionsColumn,
  columnsFor,
  defaultSortFor,
  formatSize,
  KIND_TABS,
  lastUsedColumn,
  sessionsColumn,
  usesColumn,
  type ColumnsCtx,
} from "./setup.columns";

const openExternal = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/open-external", () => ({ openExternal }));

afterEach(cleanup);

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 9,
  sessions: 4,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: 800,
  count_30d: 2,
  count_prev_30d: 1,
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "rule",
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

const ctx = (o: Partial<ColumnsCtx> = {}): ColumnsCtx => ({
  onOpen: vi.fn(),
  projectNames: new Map(),
  ...o,
});

let mountCount = 0;

/**
 * Mounts a real `DataTable` with `columnsFor`'s output — the only faithful
 * way to see what a cell renders. `stateKey` is suffixed with a counter so
 * each render gets its own `sessionStorage` slot: `DataTable` persists sort/
 * search state under `pj.table.<key>`, and two tests mounting the same
 * `kind` would otherwise silently inherit each other's sort/search state.
 */
function mount(
  kind: ArtifactKind,
  rows: ArtifactView[],
  c: ColumnsCtx = ctx(),
  sort?: { id: string; desc: boolean },
) {
  mountCount += 1;
  return render(
    <DataTable
      columns={columnsFor(kind, c)}
      rows={rows}
      rowId={(r) => String(r.id)}
      empty={{ title: "Nothing here" }}
      stateKey={`test-${kind}-${mountCount}`}
      ariaLabel="Artifacts"
      defaultSort={sort}
    />,
  );
}

/** The name column's text for every body row, in render order — reads sort order back out. */
function rowNames(): string[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelectorAll("td")[0]?.textContent ?? "");
}

describe("KIND_TABS", () => {
  it("lists every artifact tab in display order, with the exact labels", () => {
    expect(KIND_TABS).toEqual([
      { id: "rule", label: "Rules" },
      { id: "skill", label: "Skills" },
      { id: "agent", label: "Agents" },
      { id: "command", label: "Commands" },
      { id: "hook", label: "Hooks" },
      { id: "mcp_server", label: "MCP" },
      { id: "plugin", label: "Plugins" },
      { id: "settings", label: "Settings" },
    ]);
  });
});

describe("columnsFor", () => {
  it("gives skills the name/scope/usage/errorRate/avgTokens/size/actions columns, in that order", () => {
    const ids = columnsFor("skill", ctx()).map((c) => c.id);
    expect(ids).toEqual([
      "name",
      "scope",
      "uses",
      "sessions",
      "lastUsed",
      "errorRate",
      "avgTokens",
      "size",
      "actions",
    ]);
  });

  it("gives agents and commands the same shape as skills", () => {
    const shape = [
      "name",
      "scope",
      "uses",
      "sessions",
      "lastUsed",
      "errorRate",
      "avgTokens",
      "size",
      "actions",
    ];
    expect(columnsFor("agent", ctx()).map((c) => c.id)).toEqual(shape);
    expect(columnsFor("command", ctx()).map((c) => c.id)).toEqual(shape);
  });

  it("gives rules a grade column and no usage columns", () => {
    const ids = columnsFor("rule", ctx()).map((c) => c.id);
    expect(ids).toContain("grade");
    expect(ids).not.toContain("uses");
    expect(ids).not.toContain("sessions");
    expect(ids).not.toContain("lastUsed");
    expect(ids).not.toContain("errorRate");
    expect(ids).not.toContain("avgTokens");
    expect(ids).toEqual(["name", "scope", "grade", "size", "actions"]);
  });

  it("gives hooks only name and scope — no grade, usage, size or actions column", () => {
    expect(columnsFor("hook", ctx()).map((c) => c.id)).toEqual(["name", "scope"]);
  });

  it("gives MCP servers usage columns but no grade, size or actions column", () => {
    expect(columnsFor("mcp_server", ctx()).map((c) => c.id)).toEqual([
      "name",
      "scope",
      "uses",
      "sessions",
      "lastUsed",
      "errorRate",
      "avgTokens",
    ]);
  });

  it("splits usage into three sortable columns rather than one pill", () => {
    const headers = columnsFor("skill", ctx())
      .map((c) => c.header)
      .filter((h): h is string => typeof h === "string");
    expect(headers).toContain("Uses");
    expect(headers).toContain("Sessions");
    expect(headers).toContain("Last used");
    // The pill's combined sentence is gone; nothing renders it any more.
    mount("skill", [artifact({ kind: "skill", usage: usage({ total: 9, sessions: 4 }) })]);
    expect(screen.queryByText(/used 9× · 4 sessions/)).not.toBeInTheDocument();
  });

  it("gives plugins name, bundled count (as the `uses` column) and actions — no scope, grade or size", () => {
    expect(columnsFor("plugin", ctx()).map((c) => c.id)).toEqual(["name", "uses", "actions"]);
  });

  it("returns the same array reference for the same ctx object and kind", () => {
    const c = ctx();
    expect(columnsFor("skill", c)).toBe(columnsFor("skill", c));
  });

  it("returns a different reference for a different kind on the same ctx", () => {
    const c = ctx();
    expect(columnsFor("skill", c)).not.toBe(columnsFor("rule", c));
  });

  it("returns a different reference for a different ctx object, same kind", () => {
    expect(columnsFor("skill", ctx())).not.toBe(columnsFor("skill", ctx()));
  });

  it("renders a hook row's name cell as '<event>: <command>' — already baked into `name`", () => {
    mount("hook", [artifact({ kind: "hook", name: "SessionStart: echo hi" })]);
    expect(screen.getByText("SessionStart: echo hi")).toBeInTheDocument();
  });

  it("renders the name alone — a Setup name cell carries no description", () => {
    mount("plugin", [
      artifact({ kind: "plugin", name: "superpowers", description: "v6.3.0 · claude-plugins-official" }),
    ]);
    expect(screen.getByText("superpowers")).toBeInTheDocument();
    expect(screen.queryByText(/v6\.3\.0 · claude-plugins-official/)).not.toBeInTheDocument();
  });

  /**
   * The description leaves the cell but must not leave the row: hovering the
   * name is what is left of it on the tabs that have no panel to open.
   */
  it("keeps the description reachable as the name's tooltip", () => {
    mount("skill", [artifact({ kind: "skill", name: "adapt", description: "Adapts designs" })]);
    expect(screen.getByText("adapt")).toHaveAttribute("title", "adapt — Adapts designs");
  });

  it("titles the name with just the name when the row has no description", () => {
    mount("skill", [artifact({ kind: "skill", name: "adapt", description: null })]);
    expect(screen.getByText("adapt")).toHaveAttribute("title", "adapt");
  });

  it("resolves the Scope cell's project name from ctx.projectNames by path prefix", () => {
    const c = ctx({ projectNames: new Map([["/code/acme-api", "acme-api"]]) });
    mount(
      "skill",
      [artifact({ kind: "skill", layer: "project", path: "/code/acme-api/.claude/skills/deploy/SKILL.md" })],
      c,
    );
    expect(screen.getByText("acme-api")).toBeInTheDocument();
  });

  it("labels a global row's Scope cell 'Global'", () => {
    mount("skill", [artifact({ kind: "skill", layer: "global" })]);
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("names the plugin a bundled row's Scope cell came from", () => {
    mount("skill", [artifact({ kind: "skill", layer: "plugin", plugin_name: "posthog" })]);
    expect(screen.getByText("posthog")).toBeInTheDocument();
  });

  it("tells two same-named skills from different plugins apart in the Scope column", () => {
    mount("skill", [
      artifact({ id: 1, kind: "skill", name: "brainstorming", layer: "plugin", plugin_name: "superpowers" }),
      artifact({ id: 2, kind: "skill", name: "brainstorming", layer: "plugin", plugin_name: "posthog" }),
    ]);
    expect(screen.getByText("superpowers")).toBeInTheDocument();
    expect(screen.getByText("posthog")).toBeInTheDocument();
  });

  it("falls back to 'Plugin' when a bundled row carries no plugin name", () => {
    mount("skill", [artifact({ kind: "skill", layer: "plugin", plugin_name: null })]);
    expect(screen.getByText("Plugin")).toBeInTheDocument();
  });

  it("gives settings files name, scope, size and an open action", () => {
    expect(columnsFor("settings", ctx()).map((c) => c.id)).toEqual([
      "name",
      "scope",
      "size",
      "actions",
    ]);
  });

  it("opens a settings file from its actions column", () => {
    mount("settings", [
      artifact({ kind: "settings", name: "settings.json", path: "/Users/ada/.claude/settings.json" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Open settings.json" }));
    expect(openExternal).toHaveBeenCalledWith("/Users/ada/.claude/settings.json");
  });

  it("renders grade for rule rows via GradeCell", () => {
    mount("rule", [artifact({ kind: "rule", grade: "B", file_id: "f1" })]);
    expect(screen.getByLabelText("Grade B")).toBeInTheDocument();
  });

  it("renders a skill row's uses, sessions and last-used age in their own cells", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T15:00:00.000Z"));
    try {
      mount("skill", [artifact({ kind: "skill", usage: usage({ total: 9, sessions: 4 }) })]);
      const cells = [...screen.getAllByRole("row")[1].querySelectorAll("td")].map((td) => td.textContent);
      // name, scope, uses, sessions, last used, …
      expect(cells.slice(2, 5)).toEqual(["9", "4", "5h"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders an em dash for uses and sessions, and 'never', for a never-used row", () => {
    mount("skill", [artifact({ kind: "skill", usage: null })]);
    const cells = [...screen.getAllByRole("row")[1].querySelectorAll("td")].map((td) => td.textContent);
    expect(cells.slice(2, 5)).toEqual(["—", "—", "never"]);
  });

  it("formats the size column from bytes", () => {
    mount("rule", [artifact({ kind: "rule", bytes: 2048, file_id: null })]);
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("opens the rule's detail via ctx.onOpen(file_id) from the actions column, labelled with the row's own name", () => {
    const onOpen = vi.fn();
    mount("rule", [artifact({ kind: "rule", name: "no-console-in-prod", file_id: "file-1" })], ctx({ onOpen }));
    fireEvent.click(screen.getByRole("button", { name: "Open no-console-in-prod" }));
    expect(onOpen).toHaveBeenCalledWith("file-1");
  });

  it("renders no action button for a rule with no file_id", () => {
    mount("rule", [artifact({ kind: "rule", file_id: null })]);
    // Scoped to "Open ..." rather than every button in the table — the
    // column header buttons (sort toggles) are `role="button"` too.
    expect(screen.queryByRole("button", { name: /^Open/ })).not.toBeInTheDocument();
  });

  it("opens a skill's file externally by path from the actions column, labelled with the row's own name", () => {
    mount("skill", [artifact({ kind: "skill", name: "deploy", path: "/code/acme/.claude/skills/deploy/SKILL.md" })]);
    fireEvent.click(screen.getByRole("button", { name: "Open deploy" }));
    expect(openExternal).toHaveBeenCalledWith("/code/acme/.claude/skills/deploy/SKILL.md");
  });

  it("opens a plugin's folder externally by path from the actions column, labelled with the row's own name", () => {
    mount("plugin", [
      artifact({ kind: "plugin", name: "superpowers", path: "/Users/ada/.claude/plugins/superpowers" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Open folder superpowers" }));
    expect(openExternal).toHaveBeenCalledWith("/Users/ada/.claude/plugins/superpowers");
  });

  it("gives two rows with the same action distinguishable accessible names", () => {
    mount("skill", [
      artifact({ id: 1, kind: "skill", name: "deploy", path: "/a/deploy/SKILL.md" }),
      artifact({ id: 2, kind: "skill", name: "rollback", path: "/a/rollback/SKILL.md" }),
    ]);
    expect(screen.getByRole("button", { name: "Open deploy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open rollback" })).toBeInTheDocument();
  });

  it("reads the plugin bundled count from ctx.pluginBundleCounts, keyed by plugin_name", () => {
    const c = ctx({ pluginBundleCounts: new Map([["superpowers", 7]]) });
    mount("plugin", [artifact({ kind: "plugin", name: "superpowers", plugin_name: "superpowers" })], c);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("defaults the plugin bundled count to 0 when ctx carries no counts", () => {
    mount("plugin", [artifact({ kind: "plugin", name: "superpowers", plugin_name: "superpowers" })]);
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("gives ungraded rules a deterministic sort key — grade ascending groups them at the end, not scattered", () => {
    mount(
      "rule",
      [
        artifact({ id: 1, kind: "rule", name: "F", grade: "F" }),
        artifact({ id: 2, kind: "rule", name: "u1", grade: null }),
        artifact({ id: 3, kind: "rule", name: "B", grade: "B" }),
        artifact({ id: 4, kind: "rule", name: "u2", grade: null }),
        artifact({ id: 5, kind: "rule", name: "A", grade: "A" }),
        artifact({ id: 6, kind: "rule", name: "C", grade: "C" }),
      ],
      ctx(),
      defaultSortFor("rule"),
    );
    expect(rowNames()).toEqual(["A", "B", "C", "F", "u1", "u2"]);
  });

  it("sorts a skill table by uses descending by default, never-used trailing", () => {
    mount(
      "skill",
      [
        artifact({ id: 1, kind: "skill", name: "low", usage: usage({ total: 2 }) }),
        artifact({ id: 2, kind: "skill", name: "high", usage: usage({ total: 40 }) }),
        artifact({ id: 3, kind: "skill", name: "never", usage: null }),
      ],
      ctx(),
      defaultSortFor("skill"),
    );
    expect(rowNames()).toEqual(["high", "low", "never"]);
  });

  it("sorts by sessions descending via the sessions column, never-used trailing", () => {
    mount(
      "skill",
      [
        artifact({ id: 1, kind: "skill", name: "few", usage: usage({ sessions: 2 }) }),
        artifact({ id: 2, kind: "skill", name: "many", usage: usage({ sessions: 30 }) }),
        artifact({ id: 3, kind: "skill", name: "never", usage: null }),
      ],
      ctx(),
      { id: "sessions", desc: true },
    );
    expect(rowNames()).toEqual(["many", "few", "never"]);
  });

  it("sorts by the underlying timestamp, not the rendered age, with never-used last on desc", () => {
    mount(
      "skill",
      [
        // "3d" and "40d" would sort the wrong way round as text.
        artifact({ id: 1, kind: "skill", name: "old", usage: usage({ last_used: "2026-07-10T12:00:00.000Z" }) }),
        artifact({ id: 2, kind: "skill", name: "recent", usage: usage({ last_used: "2026-08-18T12:00:00.000Z" }) }),
        artifact({ id: 3, kind: "skill", name: "never", usage: null }),
        artifact({ id: 4, kind: "skill", name: "unknown", usage: usage({ last_used: null }) }),
      ],
      ctx(),
      { id: "lastUsed", desc: true },
    );
    expect(rowNames().slice(0, 2)).toEqual(["recent", "old"]);
    expect(rowNames().slice(2).sort()).toEqual(["never", "unknown"]);
  });

  it("sorts by error rate descending via the errorRate column, never-used trailing", () => {
    mount(
      "skill",
      [
        artifact({ id: 1, kind: "skill", name: "low-error", usage: usage({ error_rate: 0.1 }) }),
        artifact({ id: 2, kind: "skill", name: "high-error", usage: usage({ error_rate: 0.9 }) }),
        artifact({ id: 3, kind: "skill", name: "never", usage: null }),
      ],
      ctx(),
      { id: "errorRate", desc: true },
    );
    expect(rowNames()).toEqual(["high-error", "low-error", "never"]);
  });

  it("tones the Error % cell against the Setup error bands", () => {
    mount("skill", [
      artifact({ id: 1, kind: "skill", name: "fine", usage: usage({ error_rate: 0.02 }) }),
      artifact({ id: 2, kind: "skill", name: "shaky", usage: usage({ error_rate: 0.12 }) }),
      artifact({ id: 3, kind: "skill", name: "broken", usage: usage({ error_rate: 0.5 }) }),
    ]);
    expect(screen.getByText("2%").closest(".dt-num")).toHaveAttribute("data-tone", "good");
    expect(screen.getByText("12%").closest(".dt-num")).toHaveAttribute("data-tone", "watch");
    expect(screen.getByText("50%").closest(".dt-num")).toHaveAttribute("data-tone", "bad");
  });

  it("sorts by avg tokens descending via the avgTokens column, never-used trailing", () => {
    mount(
      "skill",
      [
        artifact({ id: 1, kind: "skill", name: "cheap", usage: usage({ avg_turn_tokens: 200 }) }),
        artifact({ id: 2, kind: "skill", name: "pricey", usage: usage({ avg_turn_tokens: 9000 }) }),
        artifact({ id: 3, kind: "skill", name: "never", usage: null }),
      ],
      ctx(),
      { id: "avgTokens", desc: true },
    );
    expect(rowNames()).toEqual(["pricey", "cheap", "never"]);
  });
});

describe("defaultSortFor", () => {
  it("sorts rules by grade ascending", () => {
    expect(defaultSortFor("rule")).toEqual({ id: "grade", desc: false });
  });

  it("sorts every kind that has a Uses column by uses descending", () => {
    const kinds: ArtifactKind[] = ["skill", "agent", "command", "mcp_server", "plugin"];
    for (const kind of kinds) {
      expect(defaultSortFor(kind)).toEqual({ id: "uses", desc: true });
    }
  });

  it("sorts settings files by name — they have no usage to rank them by", () => {
    expect(defaultSortFor("settings")).toEqual({ id: "name", desc: false });
  });

  it("sorts hooks by name, the only sortable column they carry", () => {
    // A hook table has name and scope and nothing else, so "uses desc" would
    // be a sort TanStack drops on the floor — the header would show no
    // `aria-sort` and the rows would land in inventory order.
    expect(defaultSortFor("hook")).toEqual({ id: "name", desc: false });

    mount(
      "hook",
      [
        artifact({ id: 1, kind: "hook", name: "PreToolUse: lint" }),
        artifact({ id: 2, kind: "hook", name: "Notification: say" }),
      ],
      ctx(),
      defaultSortFor("hook"),
    );

    expect(rowNames()).toEqual(["Notification: say", "PreToolUse: lint"]);
    expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
  });
});

describe("formatSize", () => {
  it("renders bytes under 1024 verbatim", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(999)).toBe("999 B");
  });

  it("renders kilobytes to one decimal place", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1536)).toBe("1.5 KB");
  });

  it("renders megabytes to one decimal place", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});

/**
 * The builders the per-kind tables compose are shared with the project page's
 * single combined table (`projectSetupColumns`), which mixes kinds in one
 * grid. These are the two seams that mixing opened.
 */
describe("shared column builders", () => {
  /** Mounts an ad-hoc column list — the builders under test, not a whole kind. */
  function mountColumns(columns: ReturnType<typeof usesColumn>[], rows: ArtifactView[]) {
    mountCount += 1;
    return render(
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(r) => String(r.id)}
        empty={{ title: "Nothing here" }}
        stateKey={`test-shared-${mountCount}`}
        ariaLabel="Artifacts"
      />,
    );
  }

  it("says never for an artifact that could have been invoked and wasn't", () => {
    mountColumns([lastUsedColumn()], [artifact({ kind: "skill", usage: null })]);
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("makes no usage claim about a kind nothing can invoke", () => {
    // A rule file is loaded, never called: "never" would read as a finding
    // about the rule rather than a fact about the column, so the guarded
    // columns fall back to the em dash every unknown value uses.
    const guard = (r: ArtifactView) => r.kind !== "rule";
    mountColumns(
      [usesColumn(guard), sessionsColumn(guard), lastUsedColumn(guard)],
      [artifact({ kind: "rule", usage: null })],
    );
    expect(screen.queryByText("never")).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });

  it("still reports usage for an invocable row under the same guard", () => {
    const guard = (r: ArtifactView) => r.kind !== "rule";
    mountColumns(
      [usesColumn(guard), sessionsColumn(guard)],
      [artifact({ kind: "skill", usage: usage({ total: 9, sessions: 4 }) })],
    );
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("resolves the action per row when handed a resolver instead of one kind", () => {
    const c = ctx();
    mountColumns(
      [actionsColumn((r) => (r.kind === "plugin" ? "folder" : "file"), c)],
      [
        artifact({ id: 1, kind: "plugin", name: "office" }),
        artifact({ id: 2, kind: "skill", name: "pdf-extract" }),
      ],
    );
    expect(screen.getByRole("button", { name: "Open folder office" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open pdf-extract" })).toBeInTheDocument();
  });

  it("opens a rule row's graded file through the resolver too", () => {
    const onOpen = vi.fn();
    mountColumns(
      [actionsColumn((r) => (r.kind === "rule" ? "rule" : "file"), ctx({ onOpen }))],
      [artifact({ id: 1, kind: "rule", name: "CLAUDE.md", file_id: "f1" })],
    );
    fireEvent.click(screen.getByRole("button", { name: "Open CLAUDE.md" }));
    expect(onOpen).toHaveBeenCalledWith("f1");
  });
});
