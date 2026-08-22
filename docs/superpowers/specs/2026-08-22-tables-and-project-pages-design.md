# Tables, project pages and ranked analytics — design

**Date:** 2026-08-22
**Status:** approved in brainstorm, awaiting owner review
**Builds on:** `2026-08-21-claude-setup-inventory-design.md` (phase 7, merged)

## 1. Why

First real-data test of phase 7 (owner, 2026-08-22): the data is right, the presentation is
not. Cards and collapsibles hide the comparisons the data exists for. Every screen that
lists things needs the same affordances — a real table, search, column sort, pill filters,
tabs — and the product needs a page per project instead of one flat "all prompts" list.

## 2. Scope

1. A shared `DataTable` foundation (TanStack Table, headless) styled with the app's tokens.
2. **Setup** → tabs per artifact kind, each a table.
3. **Projects** → `/projects` table + `/projects/:path` dedicated page; **Prompts** becomes a flat
   files table.
4. **Rules** → tabs per rule source, each a table; the add-rule flow moves to its own route.
5. **Analytics → Usage** → ranked-bar lists (label · inline bar · value) with a kind selector.

Out of scope: new backend evidence (phase 2), theming, mobile.

## 3. Shared foundation

### 3.1 `DataTable` component (`src/components/DataTable/`)

Headless `@tanstack/react-table` (v8) wrapped once:

```ts
interface DataTableProps<Row> {
  columns: ColumnDef<Row>[];          // TanStack column defs (header, cell, sortingFn, meta.align)
  rows: Row[];
  rowId: (r: Row) => string;
  search?: { placeholder: string; keys: (keyof Row | ((r: Row) => string))[] };
  pills?: PillGroup<Row>[];           // { id, label, options: {id,label,predicate}[], multi? }
  defaultSort?: { id: string; desc?: boolean };
  onRowClick?: (r: Row) => void;
  empty: { title: string; hint?: string };
  density?: "compact" | "regular";
  virtualize?: boolean;               // @tanstack/react-virtual when rows > 200
  toolbarRight?: ReactNode;           // e.g. "Add rule" CTA, "Rescan"
}
```

Behaviour: search is client-side over `keys` (debounced 150 ms); pills AND across groups, OR
within a group; sort by clicking a header (tri-state: asc → desc → none), sort indicator +
`aria-sort`; keyboard: headers focusable, rows are `button`-like when `onRowClick` is set;
sticky header; empty state when filtered to zero ("No rows match — clear filters").
State (search, pills, sort) is kept per table in the URL-less app via a `useTableState(key)`
hook backed by `sessionStorage`, so switching tabs/screens and coming back keeps the view.

Cells used everywhere (`src/components/DataTable/cells/`): `GradeCell`, `UsageCell`
(uses · sessions · last used, tone from `formatUsage`), `PercentCell`, `TokensCell`,
`ScopeCell` (Global / project name chip), `PathCell` (mono, truncated middle, title=full),
`ActionsCell` (icon buttons, accessible names).

Two constraints the implementation settled (PR 1):

- Clickable rows are **never** `role="button"` — they take `tabIndex=0`, an `aria-label`
  (overridable via `rowLabel`) and Enter/Space. A widget role must not contain focusable
  descendants, and rows carry `ActionsCell` buttons; clicks and keystrokes landing on a
  control inside a row belong to that control, never to the row.
- `PercentCell` takes a **0–1 fraction** (the shape Rust's `f64` rates arrive in, matching
  `formatUsage`'s `error_rate`), rendering a rounded whole percent; `null` renders "—".

### 3.2 `Tabs` component (`src/components/Tabs/`)

Accessible tab strip (`role=tablist/tab/tabpanel`, arrow-key navigation), count badge per tab,
`?tab=` memory via the same `useTableState`. Replaces the ad-hoc strips in Analytics and
Settings.

### 3.3 `RankedList` component (`src/components/RankedList/`)

The screenshot pattern: rows of `label · inline bar (share of max) · value`, optional
secondary value on the right, optional leading glyph, selector chips above ("Skills ·
Agents · MCP · Commands"), "Details" link at the bottom that opens the matching Setup tab
with the relevant sort applied. Bars use `--blue-tint`; an `error` variant tints red.

## 4. Screens

### 4.1 Setup (`/setup`)

Header: harness chips (detected · projects · sessions · last scan) + Rescan (progress bar).
Tabs (count badges): **Rules · Skills · Agents · Commands · Hooks · MCP · Plugins**.

Each tab is a `DataTable` of `ArtifactView` filtered by kind:

| Column | Rules | Skills/Agents/Commands | Hooks | MCP | Plugins |
|---|---|---|---|---|---|
| Name (+ description muted) | ✓ | ✓ | event: cmd | server | name + version |
| Scope (Global / project) | ✓ | ✓ | ✓ | ✓ | — |
| Grade | ✓ | — | — | — | — |
| Uses · Sessions · Last used | — | ✓ | — | ✓ | bundled count |
| Error % | — | ✓ | — | ✓ | — |
| Avg context tokens | — | ✓ | — | ✓ | — |
| Size | ✓ | ✓ | — | — | — |
| Actions | Open → Detail | Open file | — | — | Open folder |

Pills: Scope (Global / each project), Never used, Errors ≥ 25 %, High cost, Plugin-bundled.
Default sort: Uses desc (Rules: Grade asc). Search over name, description, scope.
The old Global/Projects card layout, filter chips and `<details>` rows are removed; the
"effective rules" view moves to the project page.

### 4.2 Projects (`/projects` and `/projects/:path`)

**`/projects`** — `DataTable` of projects: Logo+Name, Grade, Rule files, Open issues,
Sessions, Last session, Never-used artifacts, Errors, Folder missing (chip). Pills: Grade,
Has issues, Missing folder, Harness. Row click → project page. Replaces the sidebar's
"recent projects" as the canonical list (sidebar keeps its 6 recents).

**`/projects/:path`** — header (logo, name, path, grade ring, sessions, last session, last
scan, Rescan) then tabs:
- **Rules** — this project's graded files (Name, Kind, Grade, Issues, Modified) → Detail.
- **Effective rules** — the load-order stack (global → project) with grades; the existing
  `getEffectiveRules(harness, path)`.
- **Setup** — this project's artifacts table (same columns as Setup, no Scope column).
- **Usage** — `RankedList` of top tools in this project + sessions sparkline (from a new
  `get_project_usage(harness, path)` read model: top targets last 90 d, sessions per day).

**`/prompts`** — flat `DataTable` of all files: Name, Project (chip → project page), Kind,
Grade, Issues, Modified; pills Kind / Grade / Project / Has issues; search on path. The
current Prompts screen's grouping-by-project cards are removed.

### 4.3 Rules (`/rules`)

Tabs: **Built-in · Custom · AI standards** (count badges = rules / enabled).
Table columns: Enabled (switch), Title (+ description muted), Source badge, Severity,
Dimension, Hits (open issues it produced — new `hit_count` on `RuleInfo`), Actions
(edit/delete for custom; "view pattern" for built-in). Pills: Source, Severity, Enabled,
Has hits. Search on title/description/pattern. Toolbar CTA **Add rule** → `/rules/new`.

**`/rules/new`** — full-screen flow, two steps: choose type (Pattern rule / Natural-language
standard), then the form (existing fields), Save → back to Rules on the right tab with the
new row highlighted. Existing `add_custom_rule` / `add_nl_rule` commands unchanged. Pack
import stays as a secondary action in the Built-in tab toolbar.

### 4.4 Analytics → Usage

Replace the top-targets line chart with three `RankedList`s:
- **Top used** — selector Skills · Agents · MCP · Commands; rows = target, bar = share of
  max, value = uses; hover shows sessions + error % + avg tokens.
- **Most errors** — MCP/skills with error % > 0, value = error %, secondary = uses.
- **Most expensive** — by avg context tokens, value = tokens, secondary = uses.
Keep "Invocations by kind" and "Sessions per project" bar charts. Window selector (7d / 30d /
90d) applies to all three lists — `get_usage_overview(window_days)` gains a parameter;
`by_kind` and rates are computed over the same window.

## 5. Backend changes (small)

- `get_usage_overview(window_days: u32)` — window applied to every aggregate; `top` becomes
  `ranked: Vec<RankedTarget { kind, target, artifact_id, uses, sessions, error_rate,
  avg_turn_tokens }>` (all kinds, not top 8 — the UI ranks and slices).
- `get_project_usage(harness, project_path, window_days) → ProjectUsage { ranked, sessions_per_day: Vec<{day, sessions}> }`.
- `list_projects` gains `session_count`, `last_session_at`, `never_used_count`,
  `error_count`, `exists` (joins `harness_projects` + `usage_stats`).
- `RuleInfo.hit_count: u32` — open (non-dismissed) issues whose `rule_id` matches.
- Everything else is presentational.

## 6. Routing

`Route` adds `projects`, `project` (target = path), `rules-new`. Sidebar: Overview · Setup ·
Projects · Prompts · Analytics · Rules · Settings. Detail stays reachable from Prompts,
Projects and Setup.

## 7. Testing

- `DataTable`: unit tests for search/pill/sort composition, keyboard sort, `aria-sort`,
  row-click semantics, empty-filtered state, state persistence; stories per density and
  with every cell type.
- Each screen: util tests for column/pill definitions (pure), screen tests asserting rows,
  pills, sort, navigation; axe on every screen; stories populated/empty/filtered.
- Rust: read-model tests on the fixture for `get_usage_overview(window)`,
  `get_project_usage`, `list_projects` extras, `hit_count`.
- Gates unchanged (Rust trio, frontend four).

## 8. Delivery

Stacked PRs, one issue each, in order:
1. Foundation: `DataTable`, `Tabs`, `RankedList` (+ `@tanstack/react-table`, `react-virtual`).
2. Backend read models (§5).
3. Setup tabs + tables.
4. Projects table + project page + Prompts table.
5. Rules tables + `/rules/new`.
6. Analytics ranked lists + window; docs/status.
