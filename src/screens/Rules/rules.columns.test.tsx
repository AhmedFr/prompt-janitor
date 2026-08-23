import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import type { RuleInfo } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import {
  buildPills,
  columnsFor,
  DEFAULT_SORT,
  rowsByTab,
  severityRank,
  tabItems,
  tabOf,
  type RuleColumnsCtx,
} from "./rules.columns";

afterEach(cleanup);

const rule = (o: Partial<RuleInfo> = {}): RuleInfo => ({
  id: "r1",
  title: "No Slack references",
  description: "Flags any file that mentions Slack.",
  source: "anthropic",
  severity: "mid",
  enabled: true,
  custom: false,
  nl: false,
  // `list_rules` (query.rs) gives built-in pattern rules no pattern — they are
  // Rust code, not text — so the default fixture carries none either.
  pattern: null,
  hit_count: 0,
  ...o,
});

const ctx = (o: Partial<RuleColumnsCtx> = {}): RuleColumnsCtx => ({
  toggle: vi.fn(),
  onDelete: vi.fn(),
  onCopy: vi.fn(),
  ...o,
});

let mountCount = 0;

/**
 * Mounts a real `DataTable` with the rule column defs — the only faithful
 * way to see what a cell renders. `stateKey` is suffixed with a counter so
 * each render gets its own `sessionStorage` slot.
 */
function mount(rows: RuleInfo[], context = ctx()) {
  mountCount += 1;
  return render(
    <DataTable
      columns={columnsFor(context)}
      rows={rows}
      rowId={(r) => r.id}
      empty={{ title: "Nothing here" }}
      stateKey={`test-rules-${mountCount}`}
      ariaLabel="Rules"
      defaultSort={DEFAULT_SORT}
    />,
  );
}

/** Every body row's cells as text, in render order. */
function bodyRows(): string[][] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent ?? ""));
}

describe("tabOf", () => {
  it("puts a shipped pattern rule on the built-in tab", () => {
    expect(tabOf(rule({ custom: false, nl: false }))).toBe("builtin");
  });

  it("puts a user's own pattern rule on the custom tab", () => {
    expect(tabOf(rule({ custom: true, nl: false }))).toBe("custom");
  });

  it("puts every natural-language rule on the AI tab, custom or not", () => {
    expect(tabOf(rule({ custom: true, nl: true }))).toBe("ai");
    expect(tabOf(rule({ custom: false, nl: true }))).toBe("ai");
  });
});

describe("rowsByTab", () => {
  it("buckets every rule into exactly one tab", () => {
    const rows = [
      rule({ id: "a" }),
      rule({ id: "b", custom: true }),
      rule({ id: "c", nl: true, custom: true }),
      rule({ id: "d" }),
    ];
    const byTab = rowsByTab(rows);
    expect(byTab.get("builtin")?.map((r) => r.id)).toEqual(["a", "d"]);
    expect(byTab.get("custom")?.map((r) => r.id)).toEqual(["b"]);
    expect(byTab.get("ai")?.map((r) => r.id)).toEqual(["c"]);
  });

  it("hands back a tab with no rules an empty list rather than nothing", () => {
    const byTab = rowsByTab([rule({ id: "a" })]);
    expect(byTab.get("custom")).toEqual([]);
    expect(byTab.get("ai")).toEqual([]);
  });
});

describe("tabItems", () => {
  it("labels every tab with how many of its rules are enabled out of the total", () => {
    const rows = [
      rule({ id: "a", enabled: true }),
      rule({ id: "b", enabled: false }),
      rule({ id: "c", custom: true, enabled: true }),
      rule({ id: "d", nl: true, enabled: false }),
    ];
    expect(tabItems(rowsByTab(rows))).toEqual([
      { id: "builtin", label: "Built-in", countLabel: "1/2" },
      { id: "custom", label: "Custom", countLabel: "1/1" },
      { id: "ai", label: "AI standards", countLabel: "0/1" },
    ]);
  });

  it("says 0/0 for a tab with no rules at all", () => {
    expect(tabItems(rowsByTab([])).map((t) => t.countLabel)).toEqual(["0/0", "0/0", "0/0"]);
  });
});

describe("columnsFor", () => {
  it("lists the rule columns in spec order", () => {
    expect(columnsFor(ctx()).map((c) => c.id)).toEqual([
      "enabled",
      "title",
      "source",
      "severity",
      "hits",
      "actions",
    ]);
  });

  it("headers the columns the way the spec names them", () => {
    expect(columnsFor(ctx()).map((c) => c.header)).toEqual([
      "Enabled",
      "Title",
      "Source",
      "Severity",
      "Hits",
      "Actions",
    ]);
  });

  it("is identity-stable for the same ctx, so DataTable's memos hold", () => {
    const context = ctx();
    // One set of defs for all three tabs: a row's actions come from the row.
    expect(columnsFor(context)).toBe(columnsFor(context));
    expect(columnsFor(context)).not.toBe(columnsFor(ctx()));
  });

  it("renders the enabled state as a switch named after its rule", () => {
    mount([rule({ title: "No Slack references", enabled: true })]);
    const toggle = screen.getByRole("switch", { name: "Enable No Slack references" });
    expect(toggle).toBeChecked();
  });

  it("toggles a rule off through its switch", () => {
    const toggle = vi.fn();
    mount([rule({ id: "r7", title: "Be terse", enabled: true })], ctx({ toggle }));
    fireEvent.click(screen.getByRole("switch", { name: "Enable Be terse" }));
    expect(toggle).toHaveBeenCalledWith("r7", false);
  });

  it("toggles a disabled rule back on through its switch", () => {
    const toggle = vi.fn();
    mount([rule({ id: "r7", title: "Be terse", enabled: false })], ctx({ toggle }));
    fireEvent.click(screen.getByRole("switch", { name: "Enable Be terse" }));
    expect(toggle).toHaveBeenCalledWith("r7", true);
  });

  it("renders the title with its description muted beside it", () => {
    mount([rule({ title: "No Slack", description: "Flags any file mentioning Slack." })]);
    expect(bodyRows()[0][1]).toContain("No Slack");
    expect(bodyRows()[0][1]).toContain("Flags any file mentioning Slack.");
  });

  it("renders the source as its attribution badge", () => {
    mount([rule({ source: "karpathy" })]);
    expect(screen.getByText("Karpathy")).toBeInTheDocument();
  });

  it("renders the severity as a dot plus its word", () => {
    mount([rule({ severity: "hi" })]);
    // The dot carries the accessible name; the label is the visible text.
    expect(screen.getAllByRole("img", { name: "Critical" })).toHaveLength(1);
    expect(bodyRows()[0][3]).toContain("Critical");
  });

  it("renders the open-issue count this rule is responsible for", () => {
    mount([rule({ hit_count: 14 })]);
    expect(bodyRows()[0][4]).toBe("14");
  });

  it("offers Delete on a custom rule, named after it", () => {
    const onDelete = vi.fn();
    mount([rule({ id: "c1", title: "Never say Slack", custom: true, pattern: "slack" })], ctx({ onDelete }));
    fireEvent.click(screen.getByRole("button", { name: "Delete Never say Slack" }));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("offers both copy and delete on a custom pattern rule", () => {
    mount([rule({ id: "c1", title: "Never say Slack", custom: true, pattern: "slack" })]);
    expect(screen.getByRole("button", { name: "Copy pattern for Never say Slack" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Never say Slack" })).toBeInTheDocument();
  });

  it("still offers Delete on a natural-language standard the user wrote", () => {
    // The row that a tab-driven actions column got wrong: `custom && nl` lands
    // on the AI tab and is still the user's to remove.
    const onDelete = vi.fn();
    mount(
      [rule({ id: "n2", title: "Names its escape hatch", custom: true, nl: true, pattern: "Must say…" })],
      ctx({ onDelete }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Names its escape hatch" }));
    expect(onDelete).toHaveBeenCalledWith("n2");
  });

  it("offers Copy pattern — not Delete — on a built-in standard the user cannot remove", () => {
    const onCopy = vi.fn();
    mount(
      [rule({ title: "Has an output format", nl: true, pattern: "Must define an explicit output format" })],
      ctx({ onCopy }),
    );
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy pattern for Has an output format" }));
    expect(onCopy).toHaveBeenCalledWith("Must define an explicit output format");
  });

  it("offers no action at all on a built-in pattern rule — nothing to copy, nothing to remove", () => {
    mount([rule({ title: "No Slack", custom: false, nl: false, pattern: null })]);
    expect(screen.queryByRole("button", { name: /^Copy pattern/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
    // The Actions cell is present and empty, not missing.
    expect(bodyRows()[0][5]).toBe("");
  });
});

describe("DEFAULT_SORT", () => {
  it("opens on severity, worst first", () => {
    expect(DEFAULT_SORT).toEqual({ id: "severity", desc: true });
  });

  it("orders critical above warning above nit", () => {
    mount([
      rule({ id: "lo", title: "nit", severity: "lo", description: "" }),
      rule({ id: "hi", title: "critical", severity: "hi", description: "" }),
      rule({ id: "mid", title: "warning", severity: "mid", description: "" }),
    ]);
    expect(bodyRows().map((cells) => cells[1])).toEqual(["critical", "warning", "nit"]);
  });

  it("ranks the severities in the order the dot colours imply", () => {
    expect(severityRank("hi")).toBeGreaterThan(severityRank("mid"));
    expect(severityRank("mid")).toBeGreaterThan(severityRank("lo"));
  });
});

describe("buildPills", () => {
  it("offers one source chip per source actually present, and no others", () => {
    const rows = [rule({ id: "a", source: "openai" }), rule({ id: "b", source: "anthropic" })];
    const source = buildPills(rows).find((g) => g.id === "source");
    expect(source?.options.map((o) => o.label)).toEqual(["Anthropic", "OpenAI"]);
    expect(rows.filter(source!.options[1].predicate).map((r) => r.id)).toEqual(["a"]);
  });

  it("drops the source group when every rule shares one source", () => {
    expect(buildPills([rule({ source: "custom" })]).map((g) => g.id)).not.toContain("source");
  });

  it("offers a fixed chip per severity", () => {
    const severity = buildPills([rule()]).find((g) => g.id === "severity");
    expect(severity?.options.map((o) => o.label)).toEqual(["Critical", "Warning", "Nit"]);
  });

  it("slices on and off rules", () => {
    const rows = [rule({ id: "on", enabled: true }), rule({ id: "off", enabled: false })];
    const enabled = buildPills(rows).find((g) => g.id === "enabled");
    expect(enabled?.options.map((o) => o.label)).toEqual(["On", "Off"]);
    expect(rows.filter(enabled!.options[0].predicate).map((r) => r.id)).toEqual(["on"]);
    expect(rows.filter(enabled!.options[1].predicate).map((r) => r.id)).toEqual(["off"]);
  });

  it("slices the rules that are actually catching something", () => {
    const rows = [rule({ id: "quiet", hit_count: 0 }), rule({ id: "noisy", hit_count: 3 })];
    const hits = buildPills(rows).find((g) => g.id === "hits");
    expect(hits?.options.map((o) => o.label)).toEqual(["Has hits"]);
    expect(rows.filter(hits!.options[0].predicate).map((r) => r.id)).toEqual(["noisy"]);
  });
});
