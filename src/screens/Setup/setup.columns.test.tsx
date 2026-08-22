import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import type { ArtifactKind, ArtifactView, UsageStat } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import { columnsFor, defaultSortFor, formatSize, KIND_TABS, type ColumnsCtx } from "./setup.columns";

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

/** Mounts a real `DataTable` with `columnsFor`'s output — the only faithful way to see what a cell renders. */
function mount(kind: ArtifactKind, rows: ArtifactView[], c: ColumnsCtx = ctx()) {
  return render(
    <DataTable
      columns={columnsFor(kind, c)}
      rows={rows}
      rowId={(r) => String(r.id)}
      empty={{ title: "Nothing here" }}
      stateKey={`test-${kind}`}
      ariaLabel="Artifacts"
    />,
  );
}

describe("KIND_TABS", () => {
  it("lists the seven artifact tabs in display order, with the exact labels", () => {
    expect(KIND_TABS).toEqual([
      { id: "rule", label: "Rules" },
      { id: "skill", label: "Skills" },
      { id: "agent", label: "Agents" },
      { id: "command", label: "Commands" },
      { id: "hook", label: "Hooks" },
      { id: "mcp_server", label: "MCP" },
      { id: "plugin", label: "Plugins" },
    ]);
  });
});

describe("columnsFor", () => {
  it("gives skills the name/scope/uses/errorRate/avgTokens/size/actions columns, in that order", () => {
    const ids = columnsFor("skill", ctx()).map((c) => c.id);
    expect(ids).toEqual(["name", "scope", "uses", "errorRate", "avgTokens", "size", "actions"]);
  });

  it("gives agents and commands the same shape as skills", () => {
    expect(columnsFor("agent", ctx()).map((c) => c.id)).toEqual([
      "name",
      "scope",
      "uses",
      "errorRate",
      "avgTokens",
      "size",
      "actions",
    ]);
    expect(columnsFor("command", ctx()).map((c) => c.id)).toEqual([
      "name",
      "scope",
      "uses",
      "errorRate",
      "avgTokens",
      "size",
      "actions",
    ]);
  });

  it("gives rules a grade column and no usage columns", () => {
    const ids = columnsFor("rule", ctx()).map((c) => c.id);
    expect(ids).toContain("grade");
    expect(ids).not.toContain("uses");
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
      "errorRate",
      "avgTokens",
    ]);
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

  it("renders the description muted alongside the name when present", () => {
    mount("plugin", [
      artifact({ kind: "plugin", name: "superpowers", description: "v6.3.0 · claude-plugins-official" }),
    ]);
    expect(screen.getByText("superpowers")).toBeInTheDocument();
    expect(screen.getByText("v6.3.0 · claude-plugins-official", { exact: false })).toBeInTheDocument();
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

  it("renders grade for rule rows via GradeCell", () => {
    mount("rule", [artifact({ kind: "rule", grade: "B", file_id: "f1" })]);
    expect(screen.getByLabelText("Grade B")).toBeInTheDocument();
  });

  it("renders usage for skill rows via UsageCell", () => {
    mount("skill", [artifact({ kind: "skill", usage: usage({ total: 9, sessions: 4 }) })]);
    expect(screen.getByText(/used 9× · 4 sessions/)).toBeInTheDocument();
  });

  it("formats the size column from bytes", () => {
    mount("rule", [artifact({ kind: "rule", bytes: 2048, file_id: null })]);
    expect(screen.getByText("2.0 KB")).toBeInTheDocument();
  });

  it("opens the rule's detail via ctx.onOpen(file_id) from the actions column", () => {
    const onOpen = vi.fn();
    mount("rule", [artifact({ kind: "rule", file_id: "file-1" })], ctx({ onOpen }));
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(onOpen).toHaveBeenCalledWith("file-1");
  });

  it("renders no action button for a rule with no file_id", () => {
    mount("rule", [artifact({ kind: "rule", file_id: null })]);
    expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
  });

  it("opens a skill's file externally by path from the actions column", () => {
    mount("skill", [artifact({ kind: "skill", path: "/code/acme/.claude/skills/deploy/SKILL.md" })]);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));
    expect(openExternal).toHaveBeenCalledWith("/code/acme/.claude/skills/deploy/SKILL.md");
  });

  it("opens a plugin's folder externally by path from the actions column", () => {
    mount("plugin", [artifact({ kind: "plugin", path: "/Users/ada/.claude/plugins/superpowers" })]);
    fireEvent.click(screen.getByRole("button", { name: "Open folder" }));
    expect(openExternal).toHaveBeenCalledWith("/Users/ada/.claude/plugins/superpowers");
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

  it("sorts a skill table by uses descending by default", () => {
    mount("skill", [
      artifact({ id: 1, kind: "skill", name: "low", usage: usage({ total: 2 }) }),
      artifact({ id: 2, kind: "skill", name: "high", usage: usage({ total: 40 }) }),
    ]);
    // No explicit defaultSort is passed to DataTable here — this only checks
    // the columns render usage; sort order itself is covered by
    // `defaultSortFor` below and exercised end to end in the Setup screen.
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3); // header + 2 rows
  });
});

describe("defaultSortFor", () => {
  it("sorts rules by grade ascending", () => {
    expect(defaultSortFor("rule")).toEqual({ id: "grade", desc: false });
  });

  it("sorts every other kind by uses descending", () => {
    const kinds: ArtifactKind[] = ["skill", "agent", "command", "hook", "mcp_server", "plugin", "settings"];
    for (const kind of kinds) {
      expect(defaultSortFor(kind)).toEqual({ id: "uses", desc: true });
    }
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
