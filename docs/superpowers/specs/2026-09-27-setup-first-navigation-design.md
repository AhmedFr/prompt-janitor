# Setup-first navigation — design

**Date:** 2026-09-27
**Status:** approved in brainstorm, section by section (owner, 2026-09-27); open questions answered on review (§16)
**Issue:** #198 · **Milestone:** Phase 13: Setup-first navigation
**Mock:** before/after canvas at https://claude.ai/artifact/DPux78scLbiLBbipNQSyyg (private to the owner)
**Supersedes:** the verdict-first home of `verdict-first-ux` (PR #90). The grade stays, demoted to a badge.
**Builds on:** phase 7 (inventory + usage index), phase 8 (tables), phase 12 (file viewer #195, ACL test #194)

## 1. Why

The app grew one screen per feature and now reads as a pile of them:

| Fact (from the IA audit, 2026-09-27) | Consequence |
|---|---|
| 8 sidebar destinations plus a project page with 4 tabs | nobody can say where a thing lives |
| "Rules" names 5 things: lint rules, CLAUDE.md files (Setup tab), graded files (Project tab), load order (Project tab), a Settings stub | the most important word in the product is ambiguous |
| The overall grade shows in 6 places; 4 separate "what to fix" lists | repetition reads as clutter |
| Usage is split across Setup columns, Analytics → Usage, Project → Usage, Projects columns, the panel | the question "is this used?" has five answers |
| Links land wrong: panel "sessions today" opens Analytics → Quality; Detail's back button always goes to Prompts | the app feels unreliable |
| Empty states point to places that cannot do the thing ("Add a folder from Setup") | first-run users get stuck |

## 2. Who and what for

**User:** a solo developer tuning their Claude Code setup day to day, iterating on skills,
agents, commands and CLAUDE.md files.

**The three jobs, in priority order (owner's pick):**

1. **Read and edit my setup:** open any item, read it, change it, save.
2. **See what loads in project X:** exactly which global, project and plugin items Claude Code
   picks up there, instructions in load order.
3. **See whether it is used and what it costs:** uses, errors, tokens; spot dead weight.

Fixing findings (grades, lint issues, auto-fix) stays, one level down: it is how you improve an
item you are already looking at, not the reason you open the app.

**Success:**
- Each of the three jobs takes ≤ 2 clicks from app open.
- Every concept has exactly one name and one home.
- No screen repeats another screen's data.

## 3. Information architecture

### 3.1 Destinations

Sidebar: **Setup** (home, the app opens here) · **Projects** · **Settings**, then **Recent**
(up to 6 projects by last activity, as #186 made them).

### 3.2 Where every current screen goes

| Today | Becomes |
|---|---|
| Overview | Setup's summary line (§4.2): grade badge + one-click "needs attention" filters |
| Overview → Auto-fix card | the grade badge popover: "Fix N issues automatically" |
| Overview → Biggest wins | the Findings column + sorting by it; the panel's "Fix these next" |
| Overview → Health trend, Analytics → Quality, Scans digest | the grade badge popover (trend, open findings). Scans screen removed; the weekly digest stays a notification (Settings → Notifications) |
| Prompts | Setup with the Instructions kind selected |
| Detail | the viewer's **Findings** tab (§6.2) |
| Setup's 8 kind tabs | kind chips with counts (§4.3) |
| Project (4 tabs) | Setup with the project lens (§5) |
| Analytics → Usage | Setup usage columns + filters, and the viewer's **Usage** tab (§6.3) |
| Rules, RulesNew | Settings → **Checks** (§8) |
| Settings "Rules" stub | removed |
| Menu-bar panel | kept, links re-pointed (§9) |

### 3.3 Vocabulary (one word per thing)

| Term | Means | Replaces |
|---|---|---|
| **Instructions** | always-loaded files: CLAUDE.md, AGENTS.md, .cursorrules, … | "Rules" (Setup tab), "Rule files", "Prompts", "Prompt files" |
| **Skills, Agents, Commands, MCP servers, Hooks, Plugins** | as today | — |
| **Config** | settings.json-style harness config files | the "Settings" kind (clashed with the Settings screen) |
| **Item** | any row of the setup, of any kind | "artifact" in UI copy |
| **Checks** | lint rules: built-in, custom, AI | "Rules", "Rules & standards", "AI standards" as a screen |
| **AI checks** | natural-language checks run by the configured AI provider | "AI standards", "Natural-language standard" |
| **Findings** | what checks report on an item | "issues" in UI copy |
| **Scan** | the only verb for re-indexing | "Scan now", "Rescan", "Rescan now", "Scan everything" |
| **Add folder…** | the only label for adding a scan folder | "Add a folder…", "Choose a folder…", "Add folder…" |
| **Harness tools** | tools built into the harness (Bash, Read, …) in usage | "Built-in" in usage (clashed with built-in checks) |

A unit test pins the user-visible labels of the sidebar, the kind chips and the Settings tabs
to this table.

## 4. The Setup screen (home)

### 4.1 Header

"Setup" · **Viewing** switcher · spacer · "scanned 4m ago" · **Scan**. This is the only place in
the main window that shows the last scan time.

The Viewing switcher offers **All setup** and **as Claude Code sees _project_** (searchable list
of projects, most recently active first). Choosing a project turns on the lens (§5).

### 4.2 Summary line

`[C] 84 items · 3 never used · 1 erroring · 2 costly`

- **Grade badge:** tinted by grade. Click → popover with the 90-day health trend (the
  `TrendChart` from #187), open findings count, and "Fix N issues automatically" (the old
  Overview Auto-fix; free, no gate, see §13a).
- **The three counts are toggle filters.** "Never used", "Erroring" and "Costly" keep the
  definitions Setup's Status filter uses today (`ERROR_RATE_THRESHOLD`, the high-cost rule).
  A zero count is not rendered.

### 4.3 Kind chips and filters

`All · Instructions · Skills · Agents · Commands · MCP servers · Hooks · Plugins · Config`

- Each chip shows its count and is single-select.
- A chip with 0 items is shown disabled, not hidden, so the row of chips never reflows between
  projects.
- Next to the chips: search (name, description, path) and the **Scope** multi-select
  (Global / each project / each plugin, as today), hidden while the lens is on.

### 4.4 Table

| Column | Shown for | Notes |
|---|---|---|
| `#` | lens on, Instructions rows | load order (§5) |
| Name | all | bold (#185); description on hover and in the viewer |
| Kind | "All" chip only | |
| Scope | all | tinted badge (#185) |
| Uses | skills, agents, commands, MCP servers | the kinds the usage index counts today |
| Errors | same | rate bands from #185 |
| Tokens | all | avg per turn for used kinds; size in tokens for instructions |
| Last used | used kinds | |
| Findings | all | count, tinted by worst severity; "—" when none or not graded |

- A column no row in the current slice can fill is hidden.
- Default sort is Kind, then Name, and every column sorts.
- Row click opens the viewer (§6). With the viewer open, ⌘↑/⌘↓ step to the previous/next row of
  the current sort and filter.

### 4.5 Empty and error states

- **No harness found:** "No Claude Code setup found" + **Add folder…** (opens the folder picker
  and stores the folder, the same action as Settings → Folders).
- **Scanned, nothing matches the filters:** "No items match" + "Clear filters".
- **Read failed:** the error text + Retry.

## 5. The project lens

Setting Viewing to a project, from the switcher, a Recent entry, a Projects row or the
panel, changes three things:

1. **Rows:** only items Claude Code can use in that project, i.e. global items, that project's
   items, and items from enabled plugins.
   - **Instructions** come first, in the harness's real load order, with a `#` column. An
     instruction that loads only when working in a subfolder says so ("loaded when working in
     src/").
   - **Other kinds** follow, grouped by kind, alphabetical, with no `#`.
   - **Overrides:** where the backend knows an instruction is overridden or shadowed (what
     `MergePosition` shows in Detail today), the row is muted with "overridden by
     web-app/CLAUDE.md". The backend has no load order or override data for the other kinds,
     so nothing of the kind is claimed for them.
2. **Numbers:** Uses, Errors, Tokens and Last used count only that project's sessions.
3. **Project strip** above the table: project name, sessions per day over 90 days (small
   chart), last session, **Reveal in Finder**. When the project folder is gone, the strip
   shows the existing "folder missing" message instead and the table is empty.

The lens is part of the navigation state (§10), so Back returns to the previous lens.

## 6. The viewer

This is the sheet from #195, with one header and three tabs.

**Header:** name · kind · scope · uses · error % · last used (usage counts respect the lens) ·
"loaded in N projects" when N > 1 · Copy · Reveal · Open · ↑ ↓ · ✕.

### 6.1 Content

As #195 (Rendered/Source, highlighting, ⌘F), plus:

- **Editing** extends from skills to every markdown kind: instructions, agents, commands. It
  uses the same conflict-safe save path (`save_artifact_source` with the modified stamp) and
  the same `EDITABLE_KINDS` gate in `artifact_source.rs`.
- JSON/TOML config, MCP servers and hooks stay read-only, because their secrets are masked in
  what the viewer holds.

### 6.2 Findings

Everything Detail does, in one column:

- **Scorecard strip:** grade + the two weakest dimensions (the radar chart is dropped).
- **Findings list:** severity, line, title, and "why" on expand.
  - Clicking a finding switches to Content → Source, scrolls to the line and highlights it.
  - This fixes Detail preselecting the first finding with a line instead of the one clicked.
- **Per finding:** Suggest fix (with the AI provider, when set), Apply, Undo, Commit to a
  branch, all as today.
- **File level:** "Fix all automatically" (free, see §13a) and "Run AI checks" (when an
  AI provider is set).
- **Ungraded kinds:** "Not graded. Checks run on instruction files only." with no actions.

### 6.3 Usage

- **Skills, agents, commands, MCP servers:** uses per day (30 / 90 days toggle), error
  rate over time, average tokens per turn, last used, and a per-project breakdown where each
  project name switches the lens.
- **Instructions:** size in tokens (paid every session that loads it) and the projects that
  load it.
- **Hooks, plugins and config:** "No usage for this kind." The usage index does not count them today.

## 7. Projects

One table:

- **Columns:** logo + name · grade · instructions · items available · sessions (90 days) ·
  last session · never used · erroring.
- **Default sort:** last session, newest first.
- **Row click:** opens Setup with that project's lens.
- Nothing is managed here; folders live in Settings → Folders.
- **Empty state:** "No projects yet" + **Add folder…**.

## 8. Settings

8 tabs become 6:

| Tab | Holds | Was |
|---|---|---|
| **Folders** | detected harnesses, extra folders (add/remove), Scan | Harnesses |
| **Scanning** | schedule | Schedule |
| **Notifications** | weekly digest, regression alert | Alerts |
| **Checks** | Built-in / Custom / AI checks tables, Import pack…, Add check (the RulesNew form, inline) | the Rules screen + RulesNew + the Rules stub |
| **AI** | provider, key, model | AI |
| **About** | version, updates, storage path, danger zone | General + App |

The UpdateBanner's "Open Settings" opens **About**.

## 9. Menu-bar panel

Unchanged content (grade, delta, "Fix these next", signals, Scan, Open app, Quit), with every
link re-pointed:

| Panel link | Opens |
|---|---|
| a "Fix these next" row | Setup, that item's viewer, Findings tab |
| "N never-used skills" | Setup, Skills chip, Never used filter |
| "N MCP servers erroring" | Setup, MCP servers chip, Erroring filter |
| "N sessions today" | Projects, sorted by last session |

`open_main(route, target)` keeps its shape; `target` becomes a serialised navigation state
(§10).

## 10. Navigation state and history

Today `App.tsx` holds `route` + an optional `target`, and only some screens read `target`.

- **New state:** `{ route: "setup" | "projects" | "settings", lens?: projectPath, kind?, filters?,
  openItem?: { id, tab }, settingsTab? }`. It is one serialisable object, used by the sidebar,
  the panel, notifications and in-app links.
- **History:** a back stack in the app shell. Back (⌘[ and a toolbar arrow) pops it. The
  viewer opening and closing is a history entry, so Back closes it.
- **Legacy routes** (`overview`, `prompts`, `detail`, `project`, `analytics`, `scans`,
  `rules`, `rules-new`), if anything still sends them, map to the new state instead of a blank
  screen. For example, `detail` + file id becomes Setup with that item open on Findings.

## 11. Backend changes

| Change | Why |
|---|---|
| Project-scoped setup: return the items available in a project (global + project + enabled plugins) with usage counted from that project's sessions only. Likely a `project` parameter on `get_setup`, or a sibling command. | §5 rows and numbers |
| Load order + override flags for a project's instructions, merged into the same rows (from what `get_effective_rules` computes today) | §5 `#` column and muting |
| Per-item usage series (uses/day, error rate/day, per-project split) | §6.3 |
| `EDITABLE_KINDS` extended to instructions, agents, commands | §6.1 |
| Remove commands no screen calls after step 5 (candidates: `get_analytics`, `get_scans_digest`, `get_usage_overview`; `get_overview` stays, the panel uses it) and their capability grants | the #194 ACL test keeps the lists in step |

Each new or changed command: a Rust test on the inner function, a capability grant, and a
regenerated `bindings.ts`.

## 12. Onboarding

Detect → Scan as today. The final step reads "84 items across 9 projects · 3 never used · 1
erroring" and its button, "Open my setup", lands on Setup. The grade reveal is removed.

## 13. Out of scope

- Dark mode (no dark theme exists).
- Charging for anything, and the license flow's backend (kept, just unreachable; see §13a).
- Windows/Linux.
- New checks or grading changes.

## 13a. Everything is free (owner decision, 2026-09-27)

No payments for now, so every paywall surface is hidden rather than half-shown:

- **UI:** no "$69", "Get Pro", "paid feature" or license prompts anywhere (the Detail/Auto-fix
  copy, the TemplatePicker license redirect). Settings has no License tab.
- **Gates:** Auto-fix, Fix all, templates and every other gated action behave as unlocked,
  through the one switch `lib/monetization.ts` already has for "paused". The entitlement
  check in `apply_fix` (#91) stays in the backend but is satisfied while paused, so turning
  payments on later is one change in one place.
- **Kept:** the license verification code, `set_license`/`clear_license` and their tests stay.
  No screen reaches them.

A test asserts that no rendered screen contains "$69", "Get Pro" or "License" while
monetisation is paused.

## 14. Testing

As `shipping-a-feature`'s matrix, plus:

- **Navigation:** Vitest over the navigation-state reducer. Every legacy route and every panel
  link resolves to a non-empty state; Back restores lens, filters and open item.
- **Vocabulary:** the labels test in §3.3.
- **Lens logic:** a util test for ordering (instructions by load order, then kinds), override
  muting, and the zero-count chip rule.
- **Backend:** the project-scoped setup returns global + project + enabled plugin items and
  excludes other projects' items (fixture dir under `src-tauri/tests/fixtures/`).
- **Real build:** before step 5 merges, a bundled build is checked on the owner's Mac.
  Mocked IPC is why #192 shipped.

## 15. Rollout

Milestone **Phase 13: Setup-first navigation**. One issue and PR per step; the app works after
each.

| Step | Delivers | Done when |
|---|---|---|
| 1 | Vocabulary + Settings: 6 tabs, License tab hidden, Checks moved in, labels unified (§3.3, §8) | the labels test passes; the Rules screen redirects to Settings → Checks |
| 2 | Unified Setup table + summary line; Setup becomes home (§4) | the app opens on Setup; the kind chips replace the tabs; the three filters work |
| 3 | Viewer tabs Findings + Usage, markdown editing, grade popover (§6, §4.2) | a finding click jumps to its line; Auto-fix works from the popover |
| 4 | Project lens + Projects list + Recent → lens, backend §11 rows 1–2 (§5, §7) | the web-app lens lists only its items, in load order, with its own usage |
| 5 | Navigation state + history, panel + onboarding re-pointed, old screens, commands and hints removed (§9, §10, §12) | the navigation tests pass; the real-build check passes |

## 16. Decisions taken on review (2026-09-27)

1. **Payments:** everything is free and all paywall UI is hidden (§13a). The hiding lands in step 1
   (License tab) and step 3 (Auto-fix and Fix-all copy).
2. **Removing a scan folder** keeps #186's behaviour: its projects are deleted with it, history
   included. This is the simplest option, so no "hidden project" state is added. The Folders tab's Remove
   button says so in its confirmation: "Removes N projects and their history from Prompt
   Janitor. Files on disk are not touched.".
