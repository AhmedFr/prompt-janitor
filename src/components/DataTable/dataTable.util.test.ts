import { describe, it, expect } from "vitest";
import type { PillGroup, TableState } from "./DataTable.types";
import { applyFilters, matchesPills, matchesSearch, pillCounts } from "./dataTable.util";

interface Row {
  name: string;
  kind: string;
  archived: boolean;
}

const rows: Row[] = [
  { name: "web-rules", kind: "rule", archived: false },
  { name: "api-prompt", kind: "prompt", archived: false },
  { name: "docs-skill", kind: "skill", archived: true },
];

describe("matchesSearch", () => {
  it("requires every whitespace-separated token to match some key (AND across tokens)", () => {
    // "web" matches name, "rule" matches kind — both tokens must be satisfied
    // but each may come from a different key.
    expect(matchesSearch(rows[0], "web rule", ["name", "kind"])).toBe(true);
  });

  it("fails when a token matches no key at all", () => {
    expect(matchesSearch(rows[0], "web missing", ["name", "kind"])).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(matchesSearch(rows[0], "WEB RULE", ["name", "kind"])).toBe(true);
    expect(matchesSearch(rows[0], "Web-Rules", ["name"])).toBe(true);
  });

  it("accepts function keys alongside property keys", () => {
    const label = (r: Row) => `${r.kind}:${r.archived ? "archived" : "live"}`;
    expect(matchesSearch(rows[2], "archived", ["name", label])).toBe(true);
    expect(matchesSearch(rows[0], "archived", ["name", label])).toBe(false);
  });

  it("treats an empty or whitespace-only query as matching everything", () => {
    expect(matchesSearch(rows[0], "", ["name"])).toBe(true);
    expect(matchesSearch(rows[0], "   ", ["name"])).toBe(true);
  });
});

describe("matchesPills", () => {
  const groups: PillGroup<Row>[] = [
    {
      id: "kind",
      label: "Kind",
      options: [
        { id: "rule", label: "Rule", predicate: (r) => r.kind === "rule" },
        { id: "prompt", label: "Prompt", predicate: (r) => r.kind === "prompt" },
      ],
    },
    {
      id: "status",
      label: "Status",
      options: [{ id: "archived", label: "Archived", predicate: (r) => r.archived }],
    },
  ];

  it("passes every row when nothing is selected in any group", () => {
    expect(matchesPills(rows[0], groups, {})).toBe(true);
    expect(matchesPills(rows[2], groups, { kind: [] })).toBe(true);
  });

  it("ORs options within a group", () => {
    expect(matchesPills(rows[0], groups, { kind: ["rule", "prompt"] })).toBe(true);
    expect(matchesPills(rows[1], groups, { kind: ["rule", "prompt"] })).toBe(true);
    expect(matchesPills(rows[2], groups, { kind: ["rule", "prompt"] })).toBe(false);
  });

  it("ANDs across groups", () => {
    // rows[0] is kind=rule but not archived — matches the kind group, fails status.
    expect(matchesPills(rows[0], groups, { kind: ["rule"], status: ["archived"] })).toBe(false);
    expect(matchesPills(rows[2], groups, { kind: ["skill"], status: ["archived"] })).toBe(false);
  });

  it("matches when both a selected group and an untouched group are satisfied", () => {
    expect(matchesPills(rows[2], groups, { status: ["archived"] })).toBe(true);
  });
});

describe("applyFilters", () => {
  const groups: PillGroup<Row>[] = [
    {
      id: "kind",
      label: "Kind",
      options: [{ id: "rule", label: "Rule", predicate: (r) => r.kind === "rule" }],
    },
  ];
  const search = { placeholder: "Search…", keys: ["name" as const] };

  const state = (o: Partial<TableState> = {}): TableState => ({
    search: "",
    pills: {},
    sort: null,
    ...o,
  });

  it("returns every row when search and pills are both empty", () => {
    expect(applyFilters(rows, state(), search, groups)).toEqual(rows);
  });

  it("composes search and pill filters", () => {
    expect(applyFilters(rows, state({ search: "web" }), search, groups)).toEqual([rows[0]]);
    expect(applyFilters(rows, state({ pills: { kind: ["rule"] } }), search, groups)).toEqual([
      rows[0],
    ]);
    // "api" only appears in api-prompt, which isn't kind=rule — combined filter yields nothing.
    expect(
      applyFilters(rows, state({ search: "api", pills: { kind: ["rule"] } }), search, groups),
    ).toEqual([]);
  });

  it("ignores search/pills when their definitions are undefined", () => {
    expect(applyFilters(rows, state({ search: "web" }), undefined, undefined)).toEqual(rows);
  });
});

describe("pillCounts", () => {
  it("counts how many rows match each option's predicate", () => {
    const group: PillGroup<Row> = {
      id: "kind",
      label: "Kind",
      options: [
        { id: "rule", label: "Rule", predicate: (r) => r.kind === "rule" },
        { id: "prompt", label: "Prompt", predicate: (r) => r.kind === "prompt" },
        { id: "missing", label: "Missing", predicate: (r) => r.kind === "missing" },
      ],
    };
    expect(pillCounts(rows, group)).toEqual({ rule: 1, prompt: 1, missing: 0 });
  });
});
