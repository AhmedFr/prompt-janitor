import { describe, it, expect } from "vitest";
import type { PillGroup, TableState } from "./DataTable.types";
import {
  applyFilters,
  facetedPillCounts,
  matchesPills,
  matchesSearch,
  pillCounts,
  prunePills,
} from "./dataTable.util";

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

describe("facetedPillCounts", () => {
  const kind: PillGroup<Row> = {
    id: "kind",
    label: "Kind",
    multi: true,
    options: [
      { id: "rule", label: "Rule", predicate: (r) => r.kind === "rule" },
      { id: "prompt", label: "Prompt", predicate: (r) => r.kind === "prompt" },
      { id: "skill", label: "Skill", predicate: (r) => r.kind === "skill" },
    ],
  };
  const status: PillGroup<Row> = {
    id: "status",
    label: "Status",
    options: [
      { id: "archived", label: "Archived", predicate: (r) => r.archived },
      { id: "live", label: "Live", predicate: (r) => !r.archived },
    ],
  };
  const search = { placeholder: "Search", keys: ["name" as const] };
  const st = (patch: Partial<TableState> = {}): TableState => ({
    search: "",
    pills: {},
    sort: null,
    ...patch,
  });

  it("counts every option over the whole set when nothing is filtered", () => {
    expect(facetedPillCounts(rows, [kind, status], st(), search)).toEqual({
      kind: { rule: 1, prompt: 1, skill: 1 },
      status: { archived: 1, live: 2 },
    });
  });

  it("counts only rows the search kept", () => {
    const counts = facetedPillCounts(rows, [kind, status], st({ search: "web" }), search);
    expect(counts.kind).toEqual({ rule: 1, prompt: 0, skill: 0 });
    expect(counts.status).toEqual({ archived: 0, live: 1 });
  });

  it("narrows a group's counts by the other groups' selections", () => {
    const counts = facetedPillCounts(
      rows,
      [kind, status],
      st({ pills: { status: ["archived"] } }),
      search,
    );
    // Only docs-skill is archived, so the kind chips count within that slice.
    expect(counts.kind).toEqual({ rule: 0, prompt: 0, skill: 1 });
  });

  it("excludes a group's own selection from its counts, so its chips stay clickable", () => {
    const counts = facetedPillCounts(rows, [kind, status], st({ pills: { kind: ["rule"] } }), search);
    // Picking "rule" must not zero out "prompt" — that is how the user un-picks.
    expect(counts.kind).toEqual({ rule: 1, prompt: 1, skill: 1 });
    // The other group still narrows to the rule slice.
    expect(counts.status).toEqual({ archived: 0, live: 1 });
  });

  it("skips a group that ships its own counts", () => {
    const precomputed: PillGroup<Row> = {
      id: "kind",
      label: "Kind",
      options: [{ id: "rule", label: "Rule", predicate: () => false, count: 42 }],
    };
    expect(facetedPillCounts(rows, [precomputed], st(), search)).toEqual({});
  });
});

describe("prunePills", () => {
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

  it("keeps a selection every option of which still exists", () => {
    expect(prunePills({ kind: ["rule", "prompt"] }, groups)).toEqual({ kind: ["rule", "prompt"] });
  });

  it("drops ids whose option is gone, keeping the rest of the group", () => {
    // A remembered project pill for a project the last scan removed: the
    // option is gone, but "rule" is still a real chip the user can see.
    expect(prunePills({ kind: ["rule", "/code/deleted"] }, groups)).toEqual({ kind: ["rule"] });
  });

  it("drops the group entirely when nothing selected in it still exists", () => {
    // Left in place, `matchesPills` would fail every row against a group
    // whose selected option no longer has a predicate — an empty table with
    // no chip pressed and nothing to un-press.
    expect(prunePills({ kind: ["/code/deleted"], status: ["archived"] }, groups)).toEqual({
      status: ["archived"],
    });
  });

  it("drops a selection for a group that no longer exists at all", () => {
    expect(prunePills({ bundled: ["plugin"] }, groups)).toEqual({});
  });

  it("passes an already-clean selection through unchanged, and handles no groups", () => {
    expect(prunePills({}, groups)).toEqual({});
    expect(prunePills({ kind: ["rule"] }, [])).toEqual({});
  });
});
