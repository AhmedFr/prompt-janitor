# Data-viz epic: Overview heatmap · file radar · Analytics page

**Date:** 2026-07-09
**Status:** Approved, ready for planning

## Problem

The app grades prompt files but shows the results as flat lists. Three
mockups upgrade the reading experience:

1. **Overview heatmap** — a mosaic of one square per file (sorted best→worst,
   grade-colored) as the hero, then an auto-fix banner, then "Biggest wins".
2. **File-detail radar** — a per-file scorecard radar across five quality
   dimensions, beside the annotated source.
3. **Analytics page** — a new screen: grade distribution, health trend, most
   common issues, and headline stat tiles, over a 7d/30d/90d window.

## Decisions (locked)

- **Radar dimensions** are real, data-driven: tag every built-in rule with one
  of five dimensions and compute per-file per-dimension scores from that file's
  issues. Dimensions: **Clarity, Consistency, Structure, Examples, Format**.
- **Issues-fixed metric** is backed by a durable **fix-events** table with an
  `auto | manual` origin. It is cumulative *from ship date forward* (starts at
  0; does not retroactively reconstruct history).
- **Charts** use **Recharts** (the tested, animated library shadcn charts wrap),
  themed with the app's existing grade/color tokens. No Tailwind. The Overview
  heatmap is a **CSS grid mosaic** (no chart library — no lib offers a per-item
  mosaic).
- **Delivery**: one spec, one phased plan — Phase 1 heatmap, Phase 2 radar,
  Phase 3 analytics. Each phase is independently shippable.

## Architecture

### Backend (Rust, `src-tauri`)

**Rule dimensions (Phase 2)**
- Add `Dimension` enum (`Clarity | Consistency | Structure | Examples | Format`)
  to `engine.rs`; add `fn dimension(&self) -> Dimension` to the `Rule` trait and
  a `dimension` field to `BuiltinNlRule` (`nl_catalog.rs`).
- Tag all 14 deterministic + 25 NL built-in rules. Custom-rule issues default to
  `Consistency` (documented; the radar is primarily a built-in-standards view).
- Carry `dimension` on the engine `Issue`/`Finding` and persist it: migration
  adds `issues.dimension TEXT`; `scan.rs` writes it when inserting each issue.
- `get_file_detail` aggregates per dimension: for each of the five, count the
  file's `hi/mid/lo` issues in that dimension and score with the existing
  `score_for_counts` (a dimension with no issues = 100). `FileDetail` gains
  `dimensions: Vec<DimensionScore { dimension: String, score: u32 }>` (always
  five, fixed order).

**Fix events (Phase 3)**
- Migration adds `fix_events(id, file_id, origin TEXT, applied_at TEXT)` — one
  row per applied edit. `apply_fix` gains an `origin: String` arg
  (`"auto" | "manual"`) and inserts one row per edit. Bulk "Auto-fix N"
  (VerdictHero + Detail) passes `auto`; per-issue "Apply fix" passes `manual`.
  Append-only; `undo_fix` does not delete events (cumulative "ever fixed").

**Analytics query (Phase 3)**
- New `get_analytics(range_days: u32) -> Analytics` command:
  - `overall_score`, `overall_grade`, `overall_delta` (vs. start of window).
  - `files_tracked` (= file_count), `project_count`.
  - `issues_fixed_total / _auto / _manual` — counts from `fix_events` (optionally
    within the window; total is lifetime).
  - `open_issues` (= critical+warnings+nits), `open_critical`.
  - `grade_distribution: [{ grade, count }]` — `GROUP BY grade` over `files`.
  - `trend: [{ t, score }]` — overall `grade_history` rows with
    `CAST(recorded_at AS INTEGER) >= now - range`, ordered by time.
  - `common_issues: [{ title, files_affected }]` —
    `GROUP BY title ORDER BY COUNT(DISTINCT file_id) DESC LIMIT 6`.

**Heatmap data (Phase 1)** — no new backend. Overview reuses `list_files` for
per-file `{score, grade}` and `get_overview` for the headline totals/trend.

### Frontend (React, `src`)

**Charting (Phase 2 introduces the dep)**
- Add `recharts`. Thin themed wrappers, one folder-per-component:
  - `RadarChart` — Recharts `<RadarChart>`; five axes; filled polygon in the
    grade color; built-in enter animation.
  - `TrendChart` — Recharts `<AreaChart>` for the health trend.
  - `BarChart` usages — Recharts `<BarChart>` for grade distribution (vertical)
    and most-common-issues (horizontal).
- Each wrapper maps values to the app's CSS tokens (grade colors, `--blue`,
  `--text-*`) so charts read as one system in the existing (light) theme.

**Phase 1 — Overview heatmap**
- New `Heatmap` component: a CSS-grid mosaic of one square per file, sorted
  best→worst by score, grade-colored, with a hover title (`name · grade · score`).
  Pure helper `bucketFiles(files)` → sorted squares + per-grade legend counts;
  unit-tested.
- Restructure `Overview.tsx` (`RealOverview`) into: **heatmap hero card**
  (grade square + verdict sentence + `N files · M projects · score · Δ this
  week` + legend + mosaic + caption) → **auto-fix banner** (`N issues can be
  fixed automatically` + Auto-fix button) → **Biggest wins** (top worklist items
  with Fix/Review). Reuses `useVerdictHero` (auto-fix count/action) and the
  existing worklist; Overview hook additionally loads `list_files`.

**Phase 2 — File-detail radar**
- In `Detail`'s scorecard column, replace the lone `ScoreRing` card with a
  **File scorecard** card: header `grade · score`, the `RadarChart` of the five
  `FileDetail.dimensions`, and "Weakest on {two lowest}". Keep the issues list
  and delta below.

**Phase 3 — Analytics page**
- New `analytics` route (`App.types`), a `<Analytics>` screen, and an Analytics
  sidebar nav item (adds the item the original sidebar mockup showed; needs a
  bar-chart `IconName`). Layout: 7d/30d/90d segmented toggle → 4 stat tiles →
  grade-distribution bar chart → health-trend area chart + most-common-issues
  bars. Data via `useAnalytics(range)` calling `get_analytics`; pure shaping
  helpers unit-tested. Degrades to empty/`isTauri` states like other screens.

## Data flow

```
scan → each issue tagged with its rule's Dimension → issues.dimension
get_file_detail → aggregate issues by dimension → FileDetail.dimensions → RadarChart
apply_fix(origin) → fix_events row(s)
get_analytics(range) → tiles + grade dist + windowed trend + common issues + fix counts
list_files + get_overview → Heatmap mosaic + hero totals
```

## Error handling / edge cases

- No history in the window → trend renders empty/flat; tiles still show current
  values. `overall_delta` = 0 when <2 points.
- A file/dimension with no issues → dimension score 100 (full radar spoke).
- Custom-rule issues → `Consistency` bucket (documented); still counted in the
  overall score as today.
- `undo_fix` does not decrement `issues_fixed` (cumulative-by-design tradeoff,
  documented in the tile's tooltip/copy).
- Not under Tauri (tests/Storybook): analytics/heatmap/radar render from mocked
  data or show the existing "open the desktop app" states.
- Recharts must render inside the Tauri webview (SVG-based; safari15 target) and
  under jsdom in tests (mock or shallow-render where ResizeObserver is needed).

## Testing

- **Rust:** rule→dimension coverage (every built-in rule has a dimension);
  per-file dimension aggregation (no-issue dimension = 100; penalties lower the
  right spoke); `fix_events` counting + auto/manual split; `get_analytics`
  grade distribution, windowed trend, and common-issues grouping.
- **Frontend:** pure helpers (`bucketFiles`, analytics shaping, "weakest
  dimensions") as unit tests; `Heatmap`/`RadarChart`/`Analytics` render + a11y
  (mock the hooks, as done for Sidebar/Prompts); Recharts wrappers smoke-tested
  with a ResizeObserver shim in the test setup.

## Out of scope

- Retroactively reconstructing historical fix counts.
- Per-dimension drill-down / filtering the radar.
- Dark-theme chart variants (app currently ships one theme).
- User-configurable dimension tagging for custom rules.
