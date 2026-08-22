import type { Meta, StoryObj } from "@storybook/react";
import type { ColumnDef } from "@tanstack/react-table";
import type { Layer, UsageStat } from "@/lib/ipc";
import { DataTable } from "./DataTable";
import type { DataTableProps, PillGroup } from "./DataTable.types";
import { ActionsCell, GradeCell, PathCell, PercentCell, ScopeCell, TokensCell, UsageCell } from "./cells";

interface Artifact {
  id: string;
  name: string;
  kind: "rule" | "prompt" | "skill";
  layer: Layer;
  project: string | null;
  grade: "A" | "B" | "C" | "D" | "F" | null;
  path: string;
  usage: UsageStat | null;
  errorRate: number | null;
  tokens: number | null;
}

const NOW = new Date("2026-08-20T12:00:00.000Z");

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 24,
  sessions: 9,
  last_used: "2026-08-19T12:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: 900,
  count_30d: 12,
  count_prev_30d: 6,
  ...o,
});

const ROWS: Artifact[] = [
  {
    id: "1",
    name: "web-conventions",
    kind: "rule",
    layer: "global",
    project: null,
    grade: "A",
    path: "/Users/ada/.claude/rules/web-conventions.md",
    usage: usage(),
    errorRate: 0.02,
    tokens: 1840,
  },
  {
    id: "2",
    name: "release-checklist",
    kind: "prompt",
    layer: "project",
    project: "acme-api",
    grade: "C",
    path: "/Users/ada/code/acme-api/.claude/commands/release-checklist.md",
    usage: usage({ total: 3, sessions: 2, error_rate: 0.4 }),
    errorRate: 0.4,
    tokens: 12400,
  },
  {
    id: "3",
    name: "pdf-extract",
    kind: "skill",
    layer: "plugin",
    project: null,
    grade: null,
    path: "/Users/ada/.claude/plugins/office/skills/pdf-extract/SKILL.md",
    usage: null,
    errorRate: null,
    tokens: null,
  },
  {
    id: "4",
    name: "rust-review",
    kind: "rule",
    layer: "project",
    project: "prompt-janitor",
    grade: "B",
    path: "/Users/ada/code/prompt-janitor/CLAUDE.md",
    usage: usage({ last_used: "2026-04-02T12:00:00.000Z" }),
    errorRate: 0.05,
    tokens: 6120,
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COLUMNS: ColumnDef<Artifact, any>[] = [
  { id: "grade", header: "Grade", accessorKey: "grade", cell: (c) => <GradeCell grade={c.getValue()} /> },
  { id: "name", header: "Name", accessorKey: "name" },
  { id: "kind", header: "Kind", accessorKey: "kind" },
  {
    id: "scope",
    header: "Scope",
    accessorFn: (r) => r.project ?? r.layer,
    cell: (c) => <ScopeCell layer={c.row.original.layer} projectName={c.row.original.project} />,
  },
  { id: "path", header: "Path", accessorKey: "path", cell: (c) => <PathCell path={c.getValue()} /> },
  {
    id: "usage",
    header: "Usage",
    accessorFn: (r) => r.usage?.total ?? 0,
    cell: (c) => <UsageCell usage={c.row.original.usage} now={NOW} />,
  },
  {
    id: "errors",
    header: "Errors",
    accessorKey: "errorRate",
    meta: { align: "right" },
    cell: (c) => <PercentCell value={c.getValue()} />,
  },
  {
    id: "tokens",
    header: "Tokens",
    accessorKey: "tokens",
    meta: { align: "right" },
    cell: (c) => <TokensCell value={c.getValue()} />,
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    meta: { align: "right", interactive: true },
    cell: () => (
      <ActionsCell
        actions={[
          { label: "Open in editor", icon: "wand", onClick: () => {} },
          { label: "Remove", icon: "x", onClick: () => {} },
        ]}
      />
    ),
  },
];

const PILLS: PillGroup<Artifact>[] = [
  {
    id: "kind",
    label: "Kind",
    multi: true,
    options: [
      { id: "rule", label: "Rules", predicate: (r) => r.kind === "rule" },
      { id: "prompt", label: "Prompts", predicate: (r) => r.kind === "prompt" },
      { id: "skill", label: "Skills", predicate: (r) => r.kind === "skill" },
    ],
  },
  {
    id: "status",
    label: "Status",
    options: [
      { id: "never", label: "Never used", predicate: (r) => !r.usage },
      { id: "errors", label: "Erroring", predicate: (r) => (r.errorRate ?? 0) >= 0.1 },
    ],
  },
];

// `DataTable` is generic; Storybook's `Meta<typeof Component>` can't infer the
// row type through it, so the component is instantiated for `Artifact` here.
const ArtifactTable = DataTable<Artifact>;

const meta: Meta<DataTableProps<Artifact>> = {
  title: "Components/DataTable",
  component: ArtifactTable,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<DataTableProps<Artifact>>;

const base = {
  columns: COLUMNS,
  rows: ROWS,
  rowId: (r: Artifact) => r.id,
  empty: { title: "Nothing scanned yet", hint: "Run a scan to fill this table." },
  ariaLabel: "Artifacts",
  search: { placeholder: "Search artifacts", keys: ["name" as const, "path" as const] },
};

export const Regular: Story = { args: { ...base, stateKey: "sb-regular" } };

/** The density every in-page tab uses: more rows above the fold, same rhythm. */
export const Compact: Story = { args: { ...base, stateKey: "sb-compact", density: "compact" } };

export const WithPills: Story = {
  args: {
    ...base,
    stateKey: "sb-pills",
    pills: PILLS,
    toolbarRight: <button type="button">Add rule</button>,
  },
};

/** Clicking a row opens it; the actions column keeps its own buttons reachable. */
export const ClickableRows: Story = {
  args: { ...base, stateKey: "sb-click", onRowClick: () => {} },
};

/** Nothing scanned: the caller's copy, plus whatever CTA gets the user out of it. */
export const Empty: Story = {
  args: {
    ...base,
    stateKey: "sb-empty",
    rows: [],
    toolbarRight: <button type="button">Run a scan</button>,
  },
};

/** 1 000 rows through `@tanstack/react-virtual` — only the visible window is in the DOM. */
export const Virtualised: Story = {
  args: {
    ...base,
    stateKey: "sb-virtual",
    density: "compact",
    virtualize: true,
    rows: Array.from({ length: 1000 }, (_, i) => ({
      ...ROWS[i % ROWS.length],
      id: String(i),
      name: `${ROWS[i % ROWS.length].name}-${i}`,
    })),
  },
};
