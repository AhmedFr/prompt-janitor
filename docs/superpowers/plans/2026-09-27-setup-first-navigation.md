# Setup-first navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse Prompt Janitor's 8 destinations into Setup (home) · Projects · Settings, with a project lens on Setup and a Content / Findings / Usage viewer, one vocabulary, and no paywall UI.

**Architecture:** The Setup screen becomes one table over every item (inventory rows plus graded files the inventory never saw), filtered by kind chips and three status filters, optionally narrowed by a project lens that reorders instructions by load order and swaps in that project's usage. Every other screen's job moves into that table, the viewer sheet, or a Settings tab. At the end, a single serialisable navigation state with a back stack replaces the ad-hoc `route + target` pairs.

**Tech Stack:** React 18 + TypeScript (Vite, Vitest, Testing Library, Storybook), TanStack Table via the in-house `DataTable`, Recharts via `TrendChart`; Tauri 2 + Rust (rusqlite, specta/tauri-specta bindings), pnpm.

**Spec:** `docs/superpowers/specs/2026-09-27-setup-first-navigation-design.md` (approved, merged in #199). Read it before any task; section numbers below (§n) refer to it.

## Execution context (owner's request)

- **One branch, one PR.** All work lands on `feat/phase13-setup-first-navigation`, cut from a fresh `main`, as one commit series. One PR opens at the end (Task 5.9). It closes the five tracking issues created in Task 0.
- **Every Part ends green.** The last task of each Part runs the full `pnpm check`. It must pass before the next Part starts, and the app must build and run after every Part.
- **Fresh worktree setup**, run before the first `pnpm check`:
  `pnpm install && pnpm --dir fulfillment install && pnpm --dir landing install`
- **Load-related flakes:** if `pnpm check` fails only on `Test timed out in 5000ms` or the `markdown.parse` timing assertion, check `uptime`. When the load average is above ~12, re-run once the machine is quieter. This is not a code failure (seen on 2026-09-27).

## Global Constraints

- Package manager: **pnpm** only.
- Component layout: one folder per component with `index.ts`, `<Name>.tsx`, `<Name>.types.ts`, optional `<Name>.constants.ts`, plus `<Name>.test.tsx` **and** `<Name>.stories.tsx` (one story per visual state). Required for every component, no exceptions.
- Single responsibility per file. Split long files; logic in `*.util.ts` / hooks, layout in components.
- Tests first for every unit (superpowers:test-driven-development). Rust: `#[cfg(test)]` in the same file, test the inner fn, never the `#[tauri::command]` wrapper.
- Every new or changed Tauri command needs four things:
  1. an entry in `src-tauri/src/command_names.rs` `COMMANDS`, in the same order as `collect_commands!` in `src-tauri/src/ipc.rs`;
  2. an `allow-<kebab-name>` grant in `src-tauri/capabilities/default.json`;
  3. regenerated bindings: `cd src-tauri && cargo test --lib ipc::tests::export_typescript_bindings`, then commit `src/lib/bindings.ts`;
  4. coverage by `ipc::tests::every_command_is_granted_to_some_window` and `ipc::tests::the_acl_command_list_matches_what_the_invoke_handler_registers` (both must pass).
- Screens, IPC commands and rules import `crate::harness::model` only, never `crate::harness::claude_code::*`.
- Vocabulary (§3.3), exact strings:
  - "Instructions", "Skills", "Agents", "Commands", "MCP servers", "Hooks", "Plugins", "Config"
  - "Checks", "AI checks", "Findings", "Harness tools"
  - verb "Scan", label "Add folder…"
  - item-level noun "Item"
- Sidebar (§3.1): exactly **Setup**, **Projects**, **Settings**, then **Recent** (up to 6).
- Settings tabs (§8), in order: **Folders**, **Scanning**, **Notifications**, **Checks**, **AI**, **About**. No License tab.
- Setup kind chips (§4.3), in order: `All · Instructions · Skills · Agents · Commands · MCP servers · Hooks · Plugins · Config`.
- All free (§13a):
  - no "$69", "Get Pro", "paid feature" or "License" text on any rendered screen;
  - `PAYMENTS_ENABLED = false` in `src/lib/monetization.ts` is the one switch;
  - the backend license code and `set_license`/`clear_license` stay.
- Folder removal keeps deleting its projects (§16). The confirmation reads exactly: `Removes N projects and their history from Prompt Janitor. Files on disk are not touched.`
- `get_overview` stays (the menu-bar panel's `panel_query` uses the query). `get_scans_digest` the command is removed, but `query::get_scans_digest` the function stays (`notify.rs` uses it).
- Status dashboard: `docs/status/data.json` `recent` line + `pnpm status` in the final task (Task 5.9), committed with the PR.

## Review Focus

1. **Graded files with no inventory row.** On the owner's database, 15 of 37 graded files have no `artifacts` row (files found in extra scan folders that no harness inventoried). Deleting Prompts must not make them vanish: they must appear under Instructions, open in the viewer (content, findings), and show in their project's lens. Pinned by the tests in Tasks 2.2, 3.7 and 4.2.
2. **A project with no harness sessions, or whose folder is gone.** The lens must show the missing-folder message and an empty table, never a crash or a blank strip. Pinned in Tasks 4.3 and 4.5.
3. **Deep links arriving from outside the window.** Panel rows and stale `navigate` events with legacy routes (`detail`, `overview`, `prompts`, `project`, `analytics`, `scans`, `rules`, `rules-new`) must land somewhere useful, never on a blank shell. Pinned in Task 5.1.
4. **Stepping with ⌘↑/⌘↓ while the viewer is open,** after the user re-sorted or filtered. The step must follow what is on screen: first/last row clamps, and a row removed by a rescan closes the viewer. Pinned in Task 3.8.
5. **Editing an instruction file that changed on disk under the viewer.** The existing modified-stamp conflict path must still refuse the save and reload, now for agents, commands and instruction files as well as skills. A `.cursorrules` file must stay read-only. Pinned in Tasks 3.1 and 3.7.

---

## File structure

New files (create) and what each one owns. Modified files are named in each task.

```
src/lib/
  vocabulary.ts                 one name per concept (labels, kind names, verbs)
  vocabulary.test.ts
  autoFixAll.ts                 cross-file deterministic Auto-fix (moved out of useVerdictHero)
  autoFixAll.test.ts
src/App/
  setupTarget.ts                parse/serialise a Setup deep link (kind, filter, lens, open item, tab)
  setupTarget.test.ts
  navigation/
    navigation.types.ts         NavState, NavAction
    navigation.ts               pure reducer + back stack
    navigation.test.ts
    legacy.ts                   (route, target) from outside -> NavState
    legacy.test.ts
    useNavigation.ts            hook: state, push, replace, back, ⌘[ shortcut
    index.ts
src/components/
  DataTable/cells/FindingsCell.tsx   count tinted by worst severity
  KindChips/                    kind chips with counts
  SummaryLine/                  grade badge + counts + 3 toggle filters
  GradePopover/                 trend + open findings + Fix N automatically
  ViewingSwitcher/              "All setup" / "as Claude Code sees <project>"
  BackButton/                   toolbar back arrow
src/screens/Setup/
  setupRows.util.ts             SetupRow type, merge graded-only files into the inventory
  setupRows.util.test.ts
  setup.unified.tsx             one column set for every kind + visibility rule
  setup.unified.test.tsx
  lens.util.ts                  lens rows: load order, project-scoped usage
  lens.util.test.ts
  useLens.ts                    loads one project's lens data (from useProject)
  useLens.test.ts
  ProjectStrip/                 the lens's project strip
  ItemViewer/                   one sheet, tabs Content / Findings / Usage
  Findings/                     Findings tab (moved from Detail)
  ItemUsage/                    Usage tab
src/screens/Settings/
  Settings.constants.ts         SETTINGS_TABS + legacy tab ids
  settingsTab.util.ts           resolve a (legacy) tab id
  settingsTab.util.test.ts
  FoldersTab/                   was HarnessTab (+ remove confirmation)
  folders.util.ts               projects a folder removal deletes
  folders.util.test.ts
  ScanningTab/                  was the inline Schedule tab
  NotificationsTab/             was the inline Alerts tab
  ChecksTab/                    was the Rules screen + RulesNew form
  AboutTab/                     General + App merged
src-tauri/src/
  item_usage.rs                 per-item usage series + per-project split (get_artifact_usage)
  file_open.rs                  reveal/open a graded file or a project folder, validated against the DB
```

Deleted in Part 5 (Task 5.6), after grep proves nothing imports them:
- **Screens:** `src/screens/{Overview,Prompts,Detail,Scans,Analytics,Rules,RulesNew,Project}`.
- **Components:** `src/components/{VerdictHero,Heatmap,RadarChart}`, plus `RankedList` and `Sparkline` if unreferenced.
- **Setup panels:** `src/screens/Setup/{ArtifactPanel,SkillPanel}`, replaced by `ItemViewer`.

---
## Task 0: Branch, tracking issues, worktree

**Files:** none (repository and GitHub state only)

- [ ] **Step 1: Cut the branch from a fresh `main`**

```bash
git switch main && git pull --ff-only
git switch -c feat/phase13-setup-first-navigation
pnpm install && pnpm --dir fulfillment install && pnpm --dir landing install
```

- [ ] **Step 2: Create the five tracking issues (one per spec rollout step, §15)**

```bash
M="Phase 13: Setup-first navigation"
gh issue create -m "$M" -l area:frontend -l type:feat \
  -t "feat(ui): one vocabulary and Settings in 6 tabs (Folders, Scanning, Notifications, Checks, AI, About)" \
  -b "Step 1 of the Setup-first navigation spec (§3.3, §8, §13a, §16). Rules screen and RulesNew move into Settings → Checks; License tab and every paywall string hidden behind PAYMENTS_ENABLED=false; folder removal asks for confirmation with the project count. Done when the labels test passes and the Rules route opens Settings → Checks."
gh issue create -m "$M" -l area:frontend -l area:backend -l type:feat \
  -t "feat(setup): one Setup table with kind chips and a summary line; Setup becomes home" \
  -b "Step 2 (§4). Kind chips replace the 8 tabs, shared columns with a Findings column, never used / erroring / costly filters, graded files the inventory never saw appear under Instructions. Done when the app opens on Setup and the three filters work."
gh issue create -m "$M" -l area:frontend -l area:backend -l type:feat \
  -t "feat(setup): viewer tabs Content / Findings / Usage, markdown editing, grade popover" \
  -b "Step 3 (§6, §4.2). Detail's findings and fixes move into the viewer; per-item usage; agents, commands and instruction files become editable; the grade badge opens a trend + Fix N automatically popover. Done when a finding click jumps to its line and Auto-fix runs from the popover."
gh issue create -m "$M" -l area:frontend -l area:backend -l type:feat \
  -t "feat(setup): project lens replaces project pages; Projects list and Recent open it" \
  -b "Step 4 (§5, §7). 'as Claude Code sees <project>' shows only what loads there, instructions in load order, with that project's usage. Done when the web-app lens lists only its items, in load order, with its own usage."
gh issue create -m "$M" -l area:frontend -l area:backend -l type:chore \
  -t "chore(ui): navigation state + history, re-point panel and onboarding, remove old screens" \
  -b "Step 5 (§9, §10, §12). One NavState with a back stack; legacy routes resolve; panel links and onboarding land on Setup; Overview, Prompts, Detail, Scans, Analytics, Rules, RulesNew, Project and their dead commands removed. Done when the navigation tests and the real-build check pass."
```

Note the five issue numbers. Task 5.9's PR body closes all five. Below they are written `#S1`…`#S5`.

- [ ] **Step 3: Baseline gate**

Run: `pnpm check`
Expected: `✔ all gates passed`. If it fails on `main` before any change, stop and report. Do not build on a red baseline.

---

# Part 1: Vocabulary, all-free, Settings in 6 tabs (closes #S1)

### Task 1.1: Vocabulary module

**Files:**
- Create: `src/lib/vocabulary.ts`
- Test: `src/lib/vocabulary.test.ts`
- Modify: `src/screens/Setup/ArtifactFacts/ArtifactFacts.constants.ts` (KIND_NAME re-exports vocabulary)
- Modify: `src/screens/Setup/setup.columns.tsx:25-34` (KIND_TABS labels from vocabulary)

**Interfaces:**
- Produces:
  - `type KindFilter = "all" | ArtifactKind`
  - `KIND_LABEL: Record<ArtifactKind, string>` (plural, chip and table label)
  - `KIND_SINGULAR: Record<ArtifactKind, string>`
  - `KIND_CHIP_ORDER: readonly KindFilter[]`
  - `LABEL`: `{ scan, scanning, addFolder, all, checks, aiChecks, findings, harnessTools, item, items }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/vocabulary.test.ts
import { describe, expect, it } from "vitest";
import { KIND_CHIP_ORDER, KIND_LABEL, KIND_SINGULAR, LABEL } from "./vocabulary";

describe("vocabulary", () => {
  it("names every kind the way the spec's glossary does", () => {
    expect(KIND_LABEL).toEqual({
      rule: "Instructions",
      skill: "Skills",
      agent: "Agents",
      command: "Commands",
      mcp_server: "MCP servers",
      hook: "Hooks",
      plugin: "Plugins",
      settings: "Config",
    });
  });

  it("orders the chips All, Instructions, Skills, Agents, Commands, MCP servers, Hooks, Plugins, Config", () => {
    expect(KIND_CHIP_ORDER).toEqual([
      "all", "rule", "skill", "agent", "command", "mcp_server", "hook", "plugin", "settings",
    ]);
  });

  it("has a singular for the viewer header", () => {
    expect(KIND_SINGULAR.rule).toBe("Instruction file");
    expect(KIND_SINGULAR.settings).toBe("Config file");
    expect(KIND_SINGULAR.mcp_server).toBe("MCP server");
  });

  it("uses one verb for re-indexing and one label for adding a folder", () => {
    expect(LABEL.scan).toBe("Scan");
    expect(LABEL.addFolder).toBe("Add folder…");
    expect(LABEL.checks).toBe("Checks");
    expect(LABEL.aiChecks).toBe("AI checks");
    expect(LABEL.harnessTools).toBe("Harness tools");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/lib/vocabulary.test.ts`
Expected: FAIL. `Failed to resolve import "./vocabulary"`.

- [ ] **Step 3: Implement**

```ts
// src/lib/vocabulary.ts
import type { ArtifactKind } from "@/lib/ipc";

/**
 * One name per concept (spec §3.3). Every user-visible label for a kind, a
 * verb or a product noun comes from here, so "Rules" can never again mean
 * five different things on five screens. A test pins these strings.
 */

/** What a kind chip filters to: one kind, or everything. */
export type KindFilter = "all" | ArtifactKind;

/** Plural: chip labels, table headers, empty states. */
export const KIND_LABEL: Record<ArtifactKind, string> = {
  rule: "Instructions",
  skill: "Skills",
  agent: "Agents",
  command: "Commands",
  mcp_server: "MCP servers",
  hook: "Hooks",
  plugin: "Plugins",
  settings: "Config",
};

/** Singular: the viewer header's kind, a row's Kind cell. */
export const KIND_SINGULAR: Record<ArtifactKind, string> = {
  rule: "Instruction file",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
  mcp_server: "MCP server",
  hook: "Hook",
  plugin: "Plugin",
  settings: "Config file",
};

/** The order the Setup chips read in (§4.3). */
export const KIND_CHIP_ORDER: readonly KindFilter[] = [
  "all", "rule", "skill", "agent", "command", "mcp_server", "hook", "plugin", "settings",
] as const;

export const LABEL = {
  scan: "Scan",
  scanning: "Scanning…",
  addFolder: "Add folder…",
  all: "All",
  checks: "Checks",
  aiChecks: "AI checks",
  findings: "Findings",
  harnessTools: "Harness tools",
  item: "item",
  items: "items",
} as const;
```

In `src/screens/Setup/ArtifactFacts/ArtifactFacts.constants.ts`, replace the `KIND_NAME` literal with a re-export. The singular now comes from one place:

```ts
import { KIND_SINGULAR } from "@/lib/vocabulary";
/** A kind as the header names it — see `@/lib/vocabulary`. */
export const KIND_NAME = KIND_SINGULAR;
```

In `src/screens/Setup/setup.columns.tsx`, replace `KIND_TABS` with:

```ts
import { KIND_LABEL } from "@/lib/vocabulary";
export const KIND_TABS: { id: ArtifactKind; label: string }[] = (
  ["rule", "skill", "agent", "command", "hook", "mcp_server", "plugin", "settings"] as const
).map((id) => ({ id, label: KIND_LABEL[id] }));
```

- [ ] **Step 4: Run the new test and the suites whose strings moved**

Run: `pnpm vitest run src/lib/vocabulary.test.ts src/screens/Setup`
Expected: vocabulary PASS. Any Setup test asserting the old strings ("Rules" tab, "MCP" tab, "Settings file", "Rule") fails. Update those assertions to the new labels: "Instructions", "MCP servers", "Config", "Config file", "Instruction file". Nothing else changes. Re-run until PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vocabulary.ts src/lib/vocabulary.test.ts src/screens/Setup
git commit -m "feat(ui): one vocabulary for kinds, verbs and product nouns (#S1)"
```

### Task 1.2: All free: one payments switch, paywall UI hidden

**Files:**
- Modify: `src/lib/monetization.ts`
- Test: `src/lib/monetization.test.ts` (create)
- Modify: `src/components/TemplatePicker/TemplatePicker.tsx`, `src/components/TemplatePicker/useTemplatePicker.ts:35-38`
- Modify: `src/screens/Detail/Detail.tsx:39-47,105-120,450-466` and `src/screens/Detail/useFileDetail.ts:53-57` (Detail survives until Part 5, so it has to be clean now)
- Modify: `src/components/VerdictHero/VerdictHero.tsx` and `useVerdictHero.ts:172-194` (same reason)
- Test: `src/components/TemplatePicker/TemplatePicker.test.tsx`

**Interfaces:**
- Produces:
  - `PAYMENTS_ENABLED: boolean` (false)
  - `isUnlocked(paid: boolean | undefined): boolean`, which returns `true` whenever payments are off.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/monetization.test.ts
import { describe, expect, it } from "vitest";
import { isUnlocked, PAYMENTS_ENABLED } from "./monetization";

describe("monetization switch", () => {
  it("is off: everything is free for now (spec §13a)", () => {
    expect(PAYMENTS_ENABLED).toBe(false);
  });

  it("unlocks every gate while payments are off, whatever the entitlement says", () => {
    expect(isUnlocked(false)).toBe(true);
    expect(isUnlocked(undefined)).toBe(true);
    expect(isUnlocked(true)).toBe(true);
  });
});
```

Add this case to `src/components/TemplatePicker/TemplatePicker.test.tsx`. It reuses that file's existing render helper and mocks, with the entitlement mock returning `{ paid: false }`:

```tsx
it("never shows a purchase prompt while payments are off", async () => {
  // entitlement mocked as { paid: false } — the state that used to show "Get Pro"
  renderPicker();
  expect(await screen.findByText("Use this template")).toBeInTheDocument();
  expect(screen.queryByText(/Get Pro|\$69|License/)).toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/lib/monetization.test.ts src/components/TemplatePicker`
Expected: FAIL. `isUnlocked` and `PAYMENTS_ENABLED` are not exported, and the picker renders "Get Pro".

- [ ] **Step 3: Implement**

Prepend to `src/lib/monetization.ts` (keep the existing constants below it):

```ts
/**
 * The one switch for charging (spec §13a). Off: every gated action is open and
 * no purchase copy renders anywhere. Turning payments on later is this line
 * plus the backend's `entitlement_of`.
 */
export const PAYMENTS_ENABLED = false;

/** Whether a gated action may run. Always true while payments are off. */
export function isUnlocked(paid: boolean | undefined): boolean {
  return !PAYMENTS_ENABLED || paid === true;
}
```

Then wire the three callers:

- **`useTemplatePicker.ts`:** `setEntitled(isUnlocked(ent.status === "ok" ? ent.data.paid : undefined))`.
- **`TemplatePicker.tsx`:**
  - wrap every locked-branch node (the `Get Pro to apply templates — …` title, the `GET_PRO_LABEL` button text, the `PASTE_KEY_HINT_*` line) in `{PAYMENTS_ENABLED && …}`;
  - make the button label `busy ? "Applying…" : "Use this template"` whenever `!PAYMENTS_ENABLED`.
- **`useFileDetail.ts`:** `setEntitled(isUnlocked(ent.status === "ok" ? ent.data.paid : undefined))`. Also initialise `useState(isUnlocked(undefined))` so the first render is not "locked".
- **`Detail.tsx`:** `const autoFixLocked = !entitled;` stays. Wrap the two paid-feature sentences (lines ~116 and ~463) and the Get Pro button (~457) in `{PAYMENTS_ENABLED && …}`. Import `PAYMENTS_ENABLED`.
- **`useVerdictHero.ts`:** `entitled: isUnlocked(entRes.status === "ok" ? entRes.data.paid : undefined)`. In **`VerdictHero.tsx`**, gate the `Unlock Auto-fix — …` label and the paste-key hint behind `PAYMENTS_ENABLED`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/lib src/components/TemplatePicker src/screens/Detail src/components/VerdictHero`
Expected: PASS. A Detail or VerdictHero test that asserted the "$69" copy for an unentitled user now fails. Change it to assert the copy is **absent** (`queryByText(/\$69/)` is null). That is the new contract.

- [ ] **Step 5: Commit**

```bash
git add src/lib/monetization.ts src/lib/monetization.test.ts src/components/TemplatePicker src/screens/Detail src/components/VerdictHero
git commit -m "feat(ui): all free for now — one PAYMENTS_ENABLED switch hides every paywall string (#S1)"
```

### Task 1.3: Settings tab model: 6 tabs with legacy ids resolved

**Files:**
- Create: `src/screens/Settings/Settings.constants.ts`
- Create: `src/screens/Settings/settingsTab.util.ts`
- Test: `src/screens/Settings/settingsTab.util.test.ts`

**Interfaces:**
- Produces:
  - `type SettingsTabId = "folders" | "scanning" | "notifications" | "checks" | "ai" | "about"`
  - `SETTINGS_TABS: { id: SettingsTabId; label: string; icon: IconName }[]`
  - `resolveSettingsTab(raw: string | undefined): SettingsTabId`

- [ ] **Step 1: Write the failing test**

```ts
// src/screens/Settings/settingsTab.util.test.ts
import { describe, expect, it } from "vitest";
import { SETTINGS_TABS } from "./Settings.constants";
import { resolveSettingsTab } from "./settingsTab.util";

describe("Settings tabs", () => {
  it("are exactly Folders, Scanning, Notifications, Checks, AI, About (spec §8)", () => {
    expect(SETTINGS_TABS.map((t) => t.label)).toEqual([
      "Folders", "Scanning", "Notifications", "Checks", "AI", "About",
    ]);
  });

  it.each([
    ["harnesses", "folders"],
    ["schedule", "scanning"],
    ["alerts", "notifications"],
    ["rules", "checks"],
    ["general", "about"],
    ["app", "about"],
    ["license", "about"],
    ["ai", "ai"],
    ["checks", "checks"],
  ])("maps the old or current id %s to %s", (raw, expected) => {
    expect(resolveSettingsTab(raw)).toBe(expected);
  });

  it("falls back to the first tab for anything unknown or missing", () => {
    expect(resolveSettingsTab(undefined)).toBe("folders");
    expect(resolveSettingsTab("nope")).toBe("folders");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/screens/Settings/settingsTab.util.test.ts`
Expected: FAIL. The modules do not exist.

- [ ] **Step 3: Implement**

```ts
// src/screens/Settings/Settings.constants.ts
import type { IconName } from "@/components/Icon";

export type SettingsTabId = "folders" | "scanning" | "notifications" | "checks" | "ai" | "about";

/** The Settings strip, in order (spec §8). No License tab while payments are off (§13a). */
export const SETTINGS_TABS: { id: SettingsTabId; label: string; icon: IconName }[] = [
  { id: "folders", label: "Folders", icon: "folder" },
  { id: "scanning", label: "Scanning", icon: "clock" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "checks", label: "Checks", icon: "rules" },
  { id: "ai", label: "AI", icon: "sparkles" },
  { id: "about", label: "About", icon: "settings" },
];

/** Tab ids earlier versions linked to, and where each one lives now. */
export const LEGACY_TAB: Record<string, SettingsTabId> = {
  harnesses: "folders",
  schedule: "scanning",
  alerts: "notifications",
  rules: "checks",
  general: "about",
  app: "about",
  license: "about",
};
```

```ts
// src/screens/Settings/settingsTab.util.ts
import { LEGACY_TAB, SETTINGS_TABS, type SettingsTabId } from "./Settings.constants";

/** A tab id from anywhere (a deep link, an old notification) resolved to a tab that exists. */
export function resolveSettingsTab(raw: string | undefined): SettingsTabId {
  if (!raw) return SETTINGS_TABS[0].id;
  const current = SETTINGS_TABS.find((t) => t.id === raw);
  if (current) return current.id;
  return LEGACY_TAB[raw] ?? SETTINGS_TABS[0].id;
}
```

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Settings/settingsTab.util.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Settings/Settings.constants.ts src/screens/Settings/settingsTab.util.ts src/screens/Settings/settingsTab.util.test.ts
git commit -m "feat(settings): six-tab model with legacy tab ids resolved (#S1)"
```

### Task 1.4: Split the inline tabs into components (Scanning, Notifications, About)

`Settings.tsx` holds three tabs' markup inline. Each becomes its own component folder so the screen only switches between tabs.

**Files:**
- Create: `src/screens/Settings/ScanningTab/{index.ts,ScanningTab.tsx,ScanningTab.types.ts,ScanningTab.constants.ts,ScanningTab.test.tsx,ScanningTab.stories.tsx}`
- Create: `src/screens/Settings/NotificationsTab/{index.ts,NotificationsTab.tsx,NotificationsTab.types.ts,NotificationsTab.test.tsx,NotificationsTab.stories.tsx}`
- Create: `src/screens/Settings/AboutTab/{index.ts,AboutTab.tsx,AboutTab.types.ts,AboutTab.test.tsx,AboutTab.stories.tsx}`
- Modify: `src/screens/Settings/Settings.tsx` (becomes a switch over `SETTINGS_TABS`)
- Test: `src/screens/Settings/Settings.test.tsx` (create)

**Interfaces:**
- Consumes: `SETTINGS_TABS`, `resolveSettingsTab` (Task 1.3); `useSettings()` from `./useSettings` (existing: `schedule`, `setSchedule`, `digest`, `setDigest`, `regressions`, `setRegressions`, `status`, `ai`, `saveAi`, `testAi`, `loading`).
- Produces:
  - `ScanningTab({ schedule: string | null, onChange: (key: string) => void })`
  - `NotificationsTab({ digest: boolean, regressions: boolean, onDigest: (on: boolean) => void, onRegressions: (on: boolean) => void })`
  - `AboutTab({ status: AppStatus | null })`, which renders the About rows and then `<AppTab />`.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/screens/Settings/ScanningTab/ScanningTab.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScanningTab } from "./ScanningTab";

describe("ScanningTab", () => {
  it("marks the current frequency and reports a pick", () => {
    const onChange = vi.fn();
    render(<ScanningTab schedule="6h" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /Every 6 hours/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Once a day/ }));
    expect(onChange).toHaveBeenCalledWith("1d");
  });
});
```

```tsx
// src/screens/Settings/NotificationsTab/NotificationsTab.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationsTab } from "./NotificationsTab";

describe("NotificationsTab", () => {
  it("toggles the weekly digest and the regression alert independently", () => {
    const onDigest = vi.fn();
    const onRegressions = vi.fn();
    render(<NotificationsTab digest regressions={false} onDigest={onDigest} onRegressions={onRegressions} />);
    fireEvent.click(screen.getByRole("switch", { name: /Weekly digest/ }));
    expect(onDigest).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("switch", { name: /regresses a grade/ }));
    expect(onRegressions).toHaveBeenCalledWith(true);
  });
});
```

```tsx
// src/screens/Settings/AboutTab/AboutTab.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("../AppTab", () => ({ AppTab: () => <div data-testid="app-tab" /> }));
import { AboutTab } from "./AboutTab";

describe("AboutTab", () => {
  it("shows the storage path and the version/updates/danger block together", () => {
    render(
      <AboutTab
        status={{ schema_version: 9, db_path: "/Users/a/pj.db", project_count: 3, file_count: 12 } as never}
      />,
    );
    expect(screen.getByText("/Users/a/pj.db")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
  });
});
```

```tsx
// src/screens/Settings/Settings.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("@/lib/ipc", async () => ({ ...(await vi.importActual<object>("@/lib/ipc")), isTauri: true }));
vi.mock("./useSettings", () => ({
  useSettings: () => ({ loading: false, schedule: "6h", digest: true, regressions: true, status: null,
    ai: null, setSchedule: vi.fn(), setDigest: vi.fn(), setRegressions: vi.fn(), saveAi: vi.fn(), testAi: vi.fn() }),
}));
vi.mock("./FoldersTab", () => ({ FoldersTab: () => <div data-testid="folders" /> }));
vi.mock("./ChecksTab", () => ({ ChecksTab: () => <div data-testid="checks" /> }));
vi.mock("./AboutTab", () => ({ AboutTab: () => <div data-testid="about" /> }));
import { Settings } from "./Settings";

describe("Settings", () => {
  it("offers the six tabs and no License tab", () => {
    render(<Settings navigate={vi.fn()} />);
    for (const label of ["Folders", "Scanning", "Notifications", "Checks", "AI", "About"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "License" })).toBeNull();
  });

  it("opens an old deep link on the tab that replaced it", () => {
    render(<Settings navigate={vi.fn()} initialTab="app" />);
    expect(screen.getByTestId("about")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Settings`
Expected: FAIL (missing modules; `FoldersTab` and `ChecksTab` are created in Tasks 1.5 and 1.6).

For this step only, make `./FoldersTab` and `./ChecksTab` exist as re-exports so the Settings test can mock them. Task 1.5 turns FoldersTab into a real folder:

```ts
// src/screens/Settings/FoldersTab/index.ts (temporary until Task 1.5)
export { HarnessTab as FoldersTab } from "../HarnessTab";
```

```ts
// src/screens/Settings/ChecksTab/index.ts (temporary until Task 1.6)
export function ChecksTab() { return null; }
```

- [ ] **Step 3: Implement**

`ScanningTab.constants.ts`: move `FREQS` there as `SCAN_FREQUENCIES: { key: string; label: string; detail: string }[]` with the same five entries. `ScanningTab.tsx`: the `set-sec` heading "Scan frequency", then one `<button role="radio" aria-checked={schedule === f.key}>` per entry. Keep the existing `set-row set-row--btn`/`set-radio` classes, and call `onChange(f.key)` on click.

`NotificationsTab.tsx`: move the `AlertRow` function (currently at the bottom of `Settings.tsx`) into `NotificationsTab/AlertRow.tsx`. Give its toggle `role="switch" aria-checked={on} aria-label={label}`. Render the two rows with the existing copy, calling `onDigest(!digest)` and `onRegressions(!regressions)`.

`AboutTab.tsx`: move the `tab === "general"` block (heading "About", the "Files tracked" and "Storage" rows) here, then render `<AppTab />` below it.

`Settings.tsx`: replace `TABS`, `FREQS`, `isTab` and the tab state with:

```tsx
const [tab, setTab] = useState<SettingsTabId>(() => resolveSettingsTab(initialTab));
useEffect(() => {
  if (initialTab) setTab(resolveSettingsTab(initialTab));
}, [initialTab]);
// …strip: SETTINGS_TABS.map(({ id, label, icon }) => <button key={id} …>{label}</button>)
{tab === "folders" && <FoldersTab />}
{tab === "scanning" && <ScanningTab schedule={s.schedule} onChange={(k) => void s.setSchedule(k)} />}
{tab === "notifications" && (
  <NotificationsTab digest={s.digest} regressions={s.regressions}
    onDigest={(on) => void s.setDigest(on)} onRegressions={(on) => void s.setRegressions(on)} />
)}
{tab === "checks" && <ChecksTab />}
{tab === "ai" && <AiTab ai={s.ai} onSave={s.saveAi} onTest={s.testAi} />}
{tab === "about" && <AboutTab status={s.status} />}
```

Remove the `LicenseTab` import and the `license` branch. Keep `src/screens/Settings/LicenseTab/` on disk: §13a keeps the flow, and nothing renders it. Stories: one per component (Scanning: `Recommended`, `Manual`; Notifications: `AllOn`, `AllOff`; About: `WithStatus`, `NoStatus`), each with `args` shaped like the tests.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Settings
git commit -m "feat(settings): Scanning, Notifications and About become their own tabs; License tab hidden (#S1)"
```

### Task 1.5: Folders tab with a removal confirmation that counts what goes

**Files:**
- Move: `src/screens/Settings/HarnessTab/` → `src/screens/Settings/FoldersTab/` (`git mv`; rename `HarnessTab*` files and identifiers to `FoldersTab*`)
- Create: `src/screens/Settings/folders.util.ts`
- Test: `src/screens/Settings/folders.util.test.ts`
- Modify: `src/screens/Settings/FoldersTab/useFoldersTab.ts` (was `useHarnessTab.ts`), `FoldersTab.tsx`, `FoldersTab.test.tsx`, `FoldersTab.stories.tsx`
- Create: `src/screens/Settings/FoldersTab/FoldersTab.constants.ts`

**Interfaces:**
- Consumes: `commands.listProjects()` → `ProjectRow[]` (`id` = root path, `harness: string | null`).
- Produces:
  - `projectsRemovedBy(folder: string, remaining: string[], projects: ProjectRow[]): number`. It counts projects under `folder`, not under any `remaining` folder, and with no harness. Those are the ones `replace_extra_folders` in `src-tauri/src/scan_folders.rs` deletes.
  - `removalWarning(n: number): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/screens/Settings/folders.util.test.ts
import { describe, expect, it } from "vitest";
import type { ProjectRow } from "@/lib/ipc";
import { projectsRemovedBy, removalWarning } from "./folders.util";

const project = (id: string, harness: string | null = null) => ({ id, harness }) as ProjectRow;

describe("projectsRemovedBy", () => {
  it("counts projects inside the folder that nothing else keeps", () => {
    const projects = [project("/code/a"), project("/code/b"), project("/other/c")];
    expect(projectsRemovedBy("/code", [], projects)).toBe(2);
  });

  it("keeps a project a harness still works in", () => {
    expect(projectsRemovedBy("/code", [], [project("/code/a", "claude_code"), project("/code/b")])).toBe(1);
  });

  it("keeps a project another remaining folder still covers", () => {
    expect(projectsRemovedBy("/code", ["/code/b"], [project("/code/a"), project("/code/b")])).toBe(1);
  });

  it("does not treat a sibling with a shared prefix as inside", () => {
    expect(projectsRemovedBy("/code", [], [project("/code-archive/x")])).toBe(0);
  });
});

describe("removalWarning", () => {
  it("says exactly what the spec says, with the count", () => {
    expect(removalWarning(3)).toBe(
      "Removes 3 projects and their history from Prompt Janitor. Files on disk are not touched.",
    );
    expect(removalWarning(1)).toBe(
      "Removes 1 project and its history from Prompt Janitor. Files on disk are not touched.",
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/screens/Settings/folders.util.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/screens/Settings/folders.util.ts
import type { ProjectRow } from "@/lib/ipc";

/** `child` is `parent` or sits somewhere under it, compared on whole path segments. */
function isInside(child: string, parent: string): boolean {
  const p = parent.replace(/\/+$/, "");
  return child === p || child.startsWith(p + "/");
}

/**
 * How many projects removing `folder` deletes — the same rule
 * `replace_extra_folders` (src-tauri/src/scan_folders.rs) applies: a project
 * inside the folder goes unless another remaining folder covers it or a
 * harness still works in it.
 */
export function projectsRemovedBy(folder: string, remaining: string[], projects: ProjectRow[]): number {
  return projects.filter(
    (p) => isInside(p.id, folder) && p.harness === null && !remaining.some((r) => isInside(p.id, r)),
  ).length;
}

/** The confirmation line (spec §16), exact. */
export function removalWarning(n: number): string {
  const what = n === 1 ? "1 project and its history" : `${n} projects and their history`;
  return `Removes ${what} from Prompt Janitor. Files on disk are not touched.`;
}
```

Move the folder and rename:

```bash
git mv src/screens/Settings/HarnessTab src/screens/Settings/FoldersTab
cd src/screens/Settings/FoldersTab
for f in HarnessTab*; do git mv "$f" "${f/HarnessTab/FoldersTab}"; done
git mv useHarnessTab.ts useFoldersTab.ts
cd -
```

Replace every `HarnessTab`/`useHarnessTab` identifier and import inside the folder with `FoldersTab`/`useFoldersTab`. Replace the temporary `index.ts` from Task 1.4 with `export { FoldersTab } from "./FoldersTab";`.

In `useFoldersTab.ts`, also load `commands.listProjects()` into `projects: ProjectRow[]`. Load it in the same effect that loads folders, and refetch it on `scan-done` like the rest. Add armed state:

```ts
const [armed, setArmed] = useState<string | null>(null);
const askRemove = useCallback((path: string) => setArmed(path), []);
const cancelRemove = useCallback(() => setArmed(null), []);
const confirmRemove = useCallback(async () => {
  if (!armed) return;
  const path = armed;
  setArmed(null);
  await removeFolder(path);
}, [armed, removeFolder]);
return { /* existing fields */, projects, armed, askRemove, cancelRemove, confirmRemove };
```

In `FoldersTab.tsx`, a row's Remove button calls `askRemove(f)`. When `armed === f`, the row shows a confirmation under it instead:

```tsx
{armed === f && (
  <div className="set-confirm" role="alertdialog" aria-label={`Remove ${f}`}>
    <p>{removalWarning(projectsRemovedBy(f, extraFolders.filter((x) => x !== f), projects))}</p>
    <Button size="sm" onClick={cancelRemove}>Cancel</Button>
    <Button size="sm" variant="primary" onClick={() => void confirmRemove()}>Remove folder</Button>
  </div>
)}
```

Relabel the buttons with `LABEL.scan` ("Scan", was "Rescan now") and `LABEL.addFolder` ("Add folder…").

In `FoldersTab.test.tsx`, add these cases:
- Remove shows the warning with the right count, and does not call `setExtraScanFolders` yet.
- "Remove folder" calls it with the folder dropped.
- Cancel calls nothing.

Mock `commands.listProjects` and `commands.setExtraScanFolders` the way the existing HarnessTab test mocks `commands`. Add an `ArmedRemoval` story.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/screens/Settings
git commit -m "feat(settings): Folders tab confirms a removal with how many projects and how much history it deletes (#S1)"
```

### Task 1.6: Checks tab: the Rules screen and its form move into Settings

**Files:**
- Move: `src/screens/Rules/` → `src/screens/Settings/ChecksTab/ChecksLibrary/`. Rename `Rules*`/`rules.*` files and the `Rules` component to `ChecksLibrary*`/`checksLibrary.*`/`ChecksLibrary`. Keep `RulePanel/` as is, one folder deeper.
- Move: `src/screens/RulesNew/` → `src/screens/Settings/ChecksTab/AddCheck/`. Rename `RulesNew*`/`rulesNew.*` and `useRulesNew` to `AddCheck*`/`addCheck.*`/`useAddCheck`.
- Create: `src/screens/Settings/ChecksTab/{index.ts,ChecksTab.tsx,ChecksTab.types.ts,ChecksTab.test.tsx,ChecksTab.stories.tsx}` (replaces the Task 1.4 stub)
- Modify: `src/App/App.tsx` (routes `rules` and `rules-new` open Settings → Checks), `src/components/Sidebar/Sidebar.constants.ts` (drop the Rules item and its `NAV_OWNER` entry), `src/components/Sidebar/useSidebar.ts` (drop the `rules` badge count)

**Interfaces:**
- Produces:
  - `ChecksTab({ initialTab?: RuleTabId })`
  - `ChecksLibrary` props: `{ initialTab?: string; rules?: RuleInfo[]; onAdd: (tab: RuleTabId) => void }`. It no longer takes `navigate`.
  - `AddCheck` props: `{ initialType?: string; aiReady?: boolean; onDone: (tab: RuleTabId) => void }`. It no longer takes `navigate`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/Settings/ChecksTab/ChecksTab.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
vi.mock("./ChecksLibrary", () => ({
  ChecksLibrary: ({ onAdd }: { onAdd: (tab: string) => void }) => (
    <button onClick={() => onAdd("custom")}>Add check</button>
  ),
}));
vi.mock("./AddCheck", () => ({
  AddCheck: ({ onDone, initialType }: { onDone: (tab: string) => void; initialType?: string }) => (
    <div>
      <span>form for {initialType}</span>
      <button onClick={() => onDone("custom")}>Save check</button>
    </div>
  ),
}));
import { ChecksTab } from "./ChecksTab";

describe("ChecksTab", () => {
  it("opens the add form in place and returns to the library when it is done", () => {
    render(<ChecksTab />);
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    expect(screen.getByText("form for custom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save check" }));
    expect(screen.getByRole("button", { name: "Add check" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/screens/Settings/ChecksTab`
Expected: FAIL (ChecksLibrary and AddCheck missing).

- [ ] **Step 3: Implement**

```bash
mkdir -p src/screens/Settings/ChecksTab
git mv src/screens/Rules src/screens/Settings/ChecksTab/ChecksLibrary
git mv src/screens/RulesNew src/screens/Settings/ChecksTab/AddCheck
cd src/screens/Settings/ChecksTab/ChecksLibrary
for f in Rules.* rules.*; do n="${f/Rules./ChecksLibrary.}"; git mv "$f" "${n/rules./checksLibrary.}"; done
git mv useRules.ts useChecksLibrary.ts
cd ../AddCheck
for f in RulesNew.* rulesNew.*; do n="${f/RulesNew./AddCheck.}"; git mv "$f" "${n/rulesNew./addCheck.}"; done
git mv useRulesNew.ts useAddCheck.ts
cd -
```

Inside both folders, rename identifiers and imports (`Rules`→`ChecksLibrary`, `RulesProps`→`ChecksLibraryProps`, `useRules`→`useChecksLibrary`, `RulesNew`→`AddCheck`, `useRulesNew`→`useAddCheck`), and fix relative imports.

- **`ChecksLibrary.tsx`:**
  - drop the `<section className="screen">`, the toolbar and the `scroll-area`/`page` wrappers, since the Settings page provides them;
  - replace `navigate("rules-new", tab)` with `onAdd(tab)`;
  - remove `navigate` from `ChecksLibraryProps` and add `onAdd: (tab: RuleTabId) => void`.
- **`ChecksLibrary.constants.ts`:** `RULE_TABS` labels become `"Built-in"`, `"Custom"`, `LABEL.aiChecks`, and `ADD_RULE_LABEL = "Add check"`.
- **`useAddCheck.ts`:** replace the `navigate` parameter with `onDone: (tab: RuleTabId) => void`. `cancel` calls `onDone(initialType ?? DEFAULT_TAB)` and `save` calls `onDone(TAB_FOR[kind])`. The sessionStorage highlight hand-off stays; ChecksLibrary remounts after the form closes and reads it.
- **`AddCheck.constants.ts`:** rename user-facing "rule"/"standard" nouns to "check"/"AI check" (for example "What kind of rule?" becomes "What kind of check?" and "Natural-language standard" becomes "AI check").

```tsx
// src/screens/Settings/ChecksTab/ChecksTab.tsx
import { useState } from "react";
import type { RuleTabId } from "./ChecksLibrary/ChecksLibrary.types";
import { AddCheck } from "./AddCheck";
import { ChecksLibrary } from "./ChecksLibrary";
import type { ChecksTabProps } from "./ChecksTab.types";

/** Settings → Checks: the check library, and the add form in its place while it is open. */
export function ChecksTab({ initialTab }: ChecksTabProps) {
  const [adding, setAdding] = useState<RuleTabId | null>(null);
  const [returnTo, setReturnTo] = useState<RuleTabId | undefined>(initialTab);
  if (adding) {
    return (
      <AddCheck
        initialType={adding}
        onDone={(tab) => {
          setReturnTo(tab);
          setAdding(null);
        }}
      />
    );
  }
  return <ChecksLibrary initialTab={returnTo} onAdd={setAdding} />;
}
```

```ts
// src/screens/Settings/ChecksTab/ChecksTab.types.ts
import type { RuleTabId } from "./ChecksLibrary/ChecksLibrary.types";
export interface ChecksTabProps {
  /** The table to open on. */
  initialTab?: RuleTabId;
}
```

```ts
// src/screens/Settings/ChecksTab/index.ts
export { ChecksTab } from "./ChecksTab";
export type { ChecksTabProps } from "./ChecksTab.types";
```

In `App.tsx`:
- remove the `Rules` and `RulesNew` imports and render branches;
- in `navigate`, map `rules` and `rules-new` to settings before anything else:

```ts
if (next === "rules" || next === "rules-new") {
  setRoute("settings");
  setSettingsTab("checks");
  return;
}
```

In `App.test.tsx`, drop the two `vi.mock` lines for Rules/RulesNew and add:

```tsx
it("opens Settings → Checks for the old Rules routes", async () => {
  render(<App />);
  go("rules");
  expect(screen.getByTestId("settings")).toBeInTheDocument();
  expect(propsOf("settings").initialTab).toBe("checks");
});
```

In `Sidebar.constants.ts`, delete the `{ route: "rules", … }` item and the `"rules-new": "rules"` `NAV_OWNER` entry. In `useSidebar.ts`, drop `commands.listRules()` and the `rules` count. Stories: `ChecksTab.stories.tsx` gets `Library` (mock rules) and `Adding`. Move the old Rules/RulesNew stories' titles to `Settings/ChecksLibrary` and `Settings/AddCheck`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Settings src/App src/components/Sidebar`
Expected: PASS. Moved tests pass once their imports and renamed labels ("Add check", "AI checks") are updated.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(settings): Checks tab holds the check library and the add form; Rules leaves the sidebar (#S1)"
```

### Task 1.7: Labels sweep and Part 1 gate

**Files:**
- Modify: `src/screens/Setup/Setup.tsx` ("Rescan" → `LABEL.scan`, "Add a folder" → `LABEL.addFolder`)
- Modify: `src/components/Onboarding/Onboarding.tsx` ("Scan everything" → `LABEL.scan`, "Add a folder…" → `LABEL.addFolder`)
- Modify: `src/screens/Projects/Projects.constants.ts:15` (`EMPTY_HINT`)
- Test: `src/lib/vocabulary.labels.test.tsx` (create)

- [ ] **Step 1: Write the failing test.** It pins the sidebar labels and the Setup scan button to the glossary.

```tsx
// src/lib/vocabulary.labels.test.tsx
import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/Sidebar/Sidebar.constants";
import { EMPTY_HINT } from "@/screens/Projects/Projects.constants";

describe("glossary in the UI", () => {
  it("never labels a sidebar destination Rules", () => {
    expect(NAV_ITEMS.map((i) => i.label)).not.toContain("Rules");
  });

  it("points empty Projects at the Folders tab, not at Setup", () => {
    expect(EMPTY_HINT).toBe("Add folder… in Settings → Folders and Prompt Janitor will read what it finds inside.");
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/lib/vocabulary.labels.test.tsx`
Expected: FAIL on `EMPTY_HINT`.

- [ ] **Step 3: Implement.** Set `EMPTY_HINT` to the tested string, and replace the scan and add-folder labels listed under **Files** with `LABEL.scan` / `LABEL.addFolder` / `LABEL.scanning`. Update the tests of those components that asserted "Rescan", "Scan everything" or "Add a folder".

- [ ] **Step 4: Part 1 gate**

Run: `pnpm check`
Expected: `✔ all gates passed`. The app builds; the sidebar shows Overview, Setup, Projects, Prompts, Scans, Analytics, Settings (Rules gone); Settings shows 6 tabs.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(ui): Scan and Add folder… everywhere; empty hints point to Settings → Folders (#S1)"
```

---
# Part 2: One Setup table, and Setup becomes home (closes #S2)

### Task 2.1: Backend: findings count and worst severity on every graded row

The Findings column needs, for each item, how many findings it has and the worst one's severity. `files.issue_count` has the count. The severity comes from the `issues` table (`severity` is `hi`/`mid`/`lo`). Both `setup_view` (inventory rows) and `list_files` (graded files, used in Task 2.2 for files the inventory never saw) carry them.

**Files:**
- Modify: `src-tauri/src/harness_query.rs`: `ArtifactView` (≈line 53), `ARTIFACT_COLUMNS` (≈line 262), `artifact_row` (≈line 270)
- Modify: `src-tauri/src/query.rs`: `FileRow` struct and `list_files` (≈line 301)
- Create: `src-tauri/src/severity_sql.rs` (the shared SQL fragment + parser; one responsibility)
- Modify: `src-tauri/src/lib.rs` (`mod severity_sql;`)
- Regenerate: `src/lib/bindings.ts`

**Interfaces:**
- Produces:
  - Rust: `ArtifactView { …, issue_count: Option<u32>, worst_severity: Option<crate::engine::Severity> }`
  - Rust: `FileRow { …, worst_severity: Option<crate::engine::Severity> }`
  - TS: `ArtifactView.issue_count: number | null`, `ArtifactView.worst_severity: Severity | null`, `FileRow.worst_severity: Severity | null`

- [ ] **Step 1: Write the failing tests**

```rust
// src-tauri/src/severity_sql.rs
//! The worst open finding on a file, as one SQL expression and its parser —
//! shared by the Setup inventory and the graded-file list so both rank
//! severity the same way.

use crate::engine::Severity;

/// `hi` beats `mid` beats `lo`; `NULL` when the file has no findings.
/// `{file_id}` is the column holding the file's id in the outer query.
pub fn worst_severity_sql(file_id: &str) -> String {
    format!(
        "(SELECT CASE WHEN sum(i.severity = 'hi') > 0 THEN 'hi'
                      WHEN sum(i.severity = 'mid') > 0 THEN 'mid'
                      WHEN count(*) > 0 THEN 'lo' END
            FROM issues i WHERE i.file_id = {file_id} AND i.dismissed_at IS NULL)"
    )
}

/// The column value back to the enum; anything else is no severity.
pub fn parse_severity(raw: Option<String>) -> Option<Severity> {
    match raw.as_deref() {
        Some("hi") => Some(Severity::Hi),
        Some("mid") => Some(Severity::Mid),
        Some("lo") => Some(Severity::Lo),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    fn file_with(conn: &rusqlite::Connection, id: &str, severities: &[&str]) {
        conn.execute(
            "INSERT INTO projects(id, name, root_path) VALUES('/p', 'p', '/p') ON CONFLICT DO NOTHING",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind, grade, score, issue_count)
             VALUES(?1, '/p', ?1, 'CLAUDE.md', 'C', 70, ?2)",
            rusqlite::params![id, severities.len() as i64],
        )
        .unwrap();
        for s in severities {
            conn.execute(
                "INSERT INTO issues(file_id, severity, source, title, why) VALUES(?1, ?2, 'anthropic', 't', 'w')",
                rusqlite::params![id, s],
            )
            .unwrap();
        }
    }

    fn worst(conn: &rusqlite::Connection, id: &str) -> Option<Severity> {
        let sql = format!("SELECT {} FROM files f WHERE f.id = ?1", worst_severity_sql("f.id"));
        parse_severity(conn.query_row(&sql, [id], |r| r.get(0)).unwrap())
    }

    #[test]
    fn critical_wins_over_everything() {
        let conn = test_conn();
        file_with(&conn, "/p/a", &["lo", "hi", "mid"]);
        assert_eq!(worst(&conn, "/p/a"), Some(Severity::Hi));
    }

    #[test]
    fn warning_wins_over_nits() {
        let conn = test_conn();
        file_with(&conn, "/p/b", &["lo", "mid"]);
        assert_eq!(worst(&conn, "/p/b"), Some(Severity::Mid));
    }

    #[test]
    fn a_file_with_no_findings_has_no_severity() {
        let conn = test_conn();
        file_with(&conn, "/p/c", &[]);
        assert_eq!(worst(&conn, "/p/c"), None);
    }

    #[test]
    fn an_unknown_value_parses_to_none() {
        assert_eq!(parse_severity(Some("urgent".into())), None);
        assert_eq!(parse_severity(None), None);
    }
}
```

The inserts above match the v1 schema in `src-tauri/src/store.rs:20-55`: `projects.root_path` and `issues.source` are `NOT NULL`, and a dismissed finding (`dismissed_at` set) does not count. Add one more test that a dismissed `hi` finding alongside a `lo` one yields `Lo`, by inserting it and then running `UPDATE issues SET dismissed_at = 'x' WHERE severity = 'hi'`.

Add to the `harness_query.rs` test module:

```rust
#[test]
fn setup_view_carries_each_graded_rows_finding_count_and_worst_severity() {
    let (conn, _home) = seeded();
    let v = setup_view(&conn).unwrap();
    let rule = v.global.iter().find(|a| a.kind == ArtifactKind::Rule).unwrap();
    let file_id = rule.file_id.clone().unwrap();
    let expected: i64 = conn
        .query_row("SELECT issue_count FROM files WHERE id = ?1", [&file_id], |r| r.get(0))
        .unwrap();
    assert_eq!(rule.issue_count, Some(expected as u32));
    let has_any: i64 = conn
        .query_row("SELECT count(*) FROM issues WHERE file_id = ?1", [&file_id], |r| r.get(0))
        .unwrap();
    assert_eq!(rule.worst_severity.is_some(), has_any > 0);
    // An ungraded item has neither.
    let skill = v.global.iter().find(|a| a.name == "adapt").unwrap();
    assert_eq!((skill.issue_count, skill.worst_severity), (None, None));
}
```

- [ ] **Step 2: Run them and watch them fail**

Run: `cd src-tauri && cargo test --lib severity_sql:: harness_query::tests::setup_view_carries`
Expected: compile error. The `severity_sql` module and the `issue_count`/`worst_severity` fields do not exist yet.

- [ ] **Step 3: Implement**
  1. **Register the module:** add `mod severity_sql;` to `lib.rs`, next to the other `mod` lines.
  2. **`ArtifactView`:** add these doc-commented fields after `file_id`:
     ```rust
     /// Open findings on the graded file, when the grader saw one.
     pub issue_count: Option<u32>,
     /// The worst of them; `None` when there are none or nothing was graded.
     pub worst_severity: Option<crate::engine::Severity>,
     ```
  3. **`ARTIFACT_COLUMNS`:** it becomes a `fn artifact_columns() -> String`, so the subquery can be interpolated:
     ```rust
     fn artifact_columns() -> String {
         format!(
             "SELECT a.id, a.harness, a.layer, a.kind, a.name, a.path,
                     a.plugin_name, a.description, a.bytes, f.grade, f.score, f.id, a.project_path,
                     f.issue_count, {}
                FROM artifacts a LEFT JOIN files f ON f.id = a.file_id",
             crate::severity_sql::worst_severity_sql("f.id")
         )
     }
     ```
     Replace both `{ARTIFACT_COLUMNS}` uses in `setup_view` with `{}` + `artifact_columns()`.
  4. **`artifact_row`:** add the two new fields:
     ```rust
     issue_count: r.get::<_, Option<i64>>(13)?.map(as_u32),
     worst_severity: crate::severity_sql::parse_severity(r.get(14)?),
     ```
  5. **`query::FileRow`:** add `pub worst_severity: Option<crate::engine::Severity>` with a doc comment.
  6. **`list_files`:** append `, {}` to its SELECT list with `worst_severity_sql("f.id")`, and read it with `worst_severity: crate::severity_sql::parse_severity(r.get(9)?)`. The new column is index 9, after `rtrim(f.project_id, '/')` at 8.
  7. **Regenerate the bindings:**
     `cd src-tauri && cargo test --lib ipc::tests::export_typescript_bindings && cd ..`

- [ ] **Step 4: Run and pass**

Run: `cd src-tauri && cargo test --lib && cargo clippy --all-targets -- -D warnings && cd .. && pnpm tsc --noEmit -p tsconfig.json`
Expected: all Rust tests pass. TypeScript compile errors appear wherever a test fixture builds an `ArtifactView` or `FileRow` literal. Add `issue_count: null, worst_severity: null` (and `worst_severity: null` on `FileRow` fixtures) to each one: the Setup and Project test/story fixtures, `DataTable.stories.tsx`, `UsageBadge`/`ArtifactCard` tests and stories. Grep: `grep -rln "file_id:" src | xargs grep -l "usage:"`. Re-run until `pnpm tsc` is clean.

- [ ] **Step 5: Commit**

```bash
git add -A src-tauri src
git commit -m "feat(engine): each graded row carries its findings count and worst severity (#S2)"
```

### Task 2.2: Setup rows: the inventory plus graded files it never saw

**Files:**
- Create: `src/screens/Setup/setupRows.util.ts`
- Test: `src/screens/Setup/setupRows.util.test.ts`
- Modify: `src/screens/Setup/setup.columns.tsx`, `scopeLabel` (≈line 118) prefers a graded row's `project_label`

**Interfaces:**
- Consumes: `SetupView`, `FileRow` (`id`, `path`, `name`, `project`, `project_id`, `grade`, `score`, `issue_count`, `worst_severity`), `allArtifacts` (existing, `setup.util.ts`).
- Produces:
  - `type RowOrigin = "inventory" | "graded"`
  - `interface SetupRow extends ArtifactView { origin: RowOrigin; project_label: string | null; project_path: string | null; load_order: number | null }`
  - `syntheticId(fileId: string): number` (always negative, stable for the same id)
  - `setupRows(setup: SetupView, files: FileRow[]): SetupRow[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/screens/Setup/setupRows.util.test.ts
import { describe, expect, it } from "vitest";
import type { ArtifactView, FileRow, SetupView } from "@/lib/ipc";
import { setupRows, syntheticId } from "./setupRows.util";

const artifact = (over: Partial<ArtifactView>): ArtifactView => ({
  id: 1, harness: "claude_code", layer: "global", kind: "skill", name: "adapt", path: "/h/.claude/skills/adapt/SKILL.md",
  plugin_name: null, description: null, bytes: 100, grade: null, score: null, file_id: null, usage: null,
  issue_count: null, worst_severity: null, ...over,
});
const file = (over: Partial<FileRow>): FileRow => ({
  id: "/code/app/AGENTS.md", name: "AGENTS.md", path: "/code/app/AGENTS.md", project: "app", project_id: "/code/app",
  kind: "AGENTS.md", grade: "C", score: 70, issue_count: 2, modified: null, worst_severity: "mid", ...over,
});
const view = (global: ArtifactView[], projectArtifacts: ArtifactView[] = []): SetupView => ({
  harnesses: [],
  global,
  projects: [{ harness: "claude_code", path: "/code/app", name: "app", exists: true, session_count: 3,
    last_session_at: null, artifacts: projectArtifacts }],
});

describe("setupRows", () => {
  it("keeps every inventory row, marked as inventory", () => {
    const rows = setupRows(view([artifact({ id: 7 })]), []);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 7, origin: "inventory", load_order: null });
  });

  it("adds a graded file no inventory row points at, as an instruction of its project", () => {
    const rows = setupRows(view([]), [file({})]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      origin: "graded", kind: "rule", layer: "project", name: "AGENTS.md", file_id: "/code/app/AGENTS.md",
      project_label: "app", project_path: "/code/app", issue_count: 2, worst_severity: "mid", grade: "C",
    });
    expect(rows[0].id).toBeLessThan(0);
  });

  it("does not duplicate a graded file the inventory already has", () => {
    const inInventory = artifact({ id: 3, kind: "rule", name: "CLAUDE.md", file_id: "/code/app/CLAUDE.md" });
    const rows = setupRows(view([], [inInventory]), [file({ id: "/code/app/CLAUDE.md", name: "CLAUDE.md" })]);
    expect(rows.map((r) => r.id)).toEqual([3]);
  });

  it("gives a project's inventory rows their project path", () => {
    const rows = setupRows(view([], [artifact({ id: 9, layer: "project", path: "/code/app/.claude/agents/x.md" })]), []);
    expect(rows[0].project_path).toBe("/code/app");
  });
});

describe("syntheticId", () => {
  it("is negative and stable for the same file", () => {
    expect(syntheticId("/a/b")).toBeLessThan(0);
    expect(syntheticId("/a/b")).toBe(syntheticId("/a/b"));
    expect(syntheticId("/a/b")).not.toBe(syntheticId("/a/c"));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/screens/Setup/setupRows.util.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/screens/Setup/setupRows.util.ts
import type { ArtifactView, FileRow, SetupView } from "@/lib/ipc";

/** Where a row came from: the harness inventory, or a graded file the inventory never saw. */
export type RowOrigin = "inventory" | "graded";

/**
 * One row of the Setup table. The inventory is not the whole story: files the
 * grader found in an extra scan folder (15 of 37 on the owner's machine) have
 * no inventory row, and deleting Prompts must not make them vanish — they
 * join as instructions of their project.
 */
export interface SetupRow extends ArtifactView {
  origin: RowOrigin;
  /** Project name for a graded-only row, whose path no inventory project may know. */
  project_label: string | null;
  /** Owning project root, or `null` for global and plugin rows. */
  project_path: string | null;
  /** Position in the lens's load order (Part 4); `null` outside the lens. */
  load_order: number | null;
}

/** A stable, always-negative id for a row with no `artifacts.id` (djb2 over the file id). */
export function syntheticId(fileId: string): number {
  let h = 5381;
  for (let i = 0; i < fileId.length; i++) h = ((h << 5) + h + fileId.charCodeAt(i)) | 0;
  return -(Math.abs(h) + 1);
}

function fromGraded(f: FileRow): SetupRow {
  return {
    id: syntheticId(f.id),
    harness: "",
    layer: "project",
    kind: "rule",
    name: f.name,
    path: f.path,
    plugin_name: null,
    description: null,
    bytes: 0,
    grade: f.grade,
    score: f.score,
    file_id: f.id,
    usage: null,
    issue_count: f.issue_count,
    worst_severity: f.worst_severity,
    origin: "graded",
    project_label: f.project,
    project_path: f.project_id,
    load_order: null,
  };
}

/** Every Setup row: global + plugin + each project's inventory, then graded files nothing inventoried. */
export function setupRows(setup: SetupView, files: FileRow[]): SetupRow[] {
  const inventory: SetupRow[] = [
    ...setup.global.map((a) => ({ ...a, origin: "inventory" as const, project_label: null, project_path: null, load_order: null })),
    ...setup.projects.flatMap((p) =>
      p.artifacts.map((a) => ({ ...a, origin: "inventory" as const, project_label: null, project_path: p.path, load_order: null })),
    ),
  ];
  const known = new Set(inventory.map((r) => r.file_id).filter((id): id is string => id !== null));
  const graded = files.filter((f) => !known.has(f.id)).map(fromGraded);
  return [...inventory, ...graded];
}
```

In `setup.columns.tsx` `scopeLabel`, add a first line: `if ("project_label" in row && row.project_label) return row.project_label;`. The row type stays `ArtifactView`, so the `in` check keeps the helper usable for both types.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup/setupRows.util.test.ts src/screens/Setup/setup.columns.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Setup/setupRows.util.ts src/screens/Setup/setupRows.util.test.ts src/screens/Setup/setup.columns.tsx
git commit -m "feat(setup): graded files the inventory never saw join the Setup rows as instructions (#S2)"
```

### Task 2.3: FindingsCell

**Files:**
- Create: `src/components/DataTable/cells/FindingsCell.tsx`
- Modify: `src/components/DataTable/cells/cells.types.ts` (add `FindingsCellProps`), `cells.css`, `index.ts`, `Cells.stories.tsx`
- Test: `src/components/DataTable/cells/cells.test.tsx` (add cases)

**Interfaces:**
- Produces: `FindingsCell({ count: number | null, severity: Severity | null })`

- [ ] **Step 1: Write the failing test** (append to `cells.test.tsx`)

```tsx
import { FindingsCell } from "./FindingsCell";

describe("FindingsCell", () => {
  it("shows a muted dash when there is nothing to report", () => {
    const { container } = render(<FindingsCell count={0} severity={null} />);
    expect(container.textContent).toBe("—");
    render(<FindingsCell count={null} severity={null} />);
  });

  it("tints the count by the worst finding", () => {
    render(<FindingsCell count={3} severity="hi" />);
    const badge = screen.getByText("3");
    expect(badge).toHaveAttribute("data-severity", "hi");
    expect(badge).toHaveAccessibleName("3 findings, worst critical");
  });

  it("says one finding in the singular", () => {
    render(<FindingsCell count={1} severity="lo" />);
    expect(screen.getByText("1")).toHaveAccessibleName("1 finding, worst nit");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/DataTable/cells/cells.test.tsx -t FindingsCell`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// cells.types.ts (add)
import type { Severity } from "@/lib/ipc";
export interface FindingsCellProps {
  count: number | null;
  severity: Severity | null;
}
```

```tsx
// src/components/DataTable/cells/FindingsCell.tsx
import "./cells.css";
import type { FindingsCellProps } from "./cells.types";
import { EMPTY_MARK } from "./cells.util";

const SEVERITY_WORD = { hi: "critical", mid: "warning", lo: "nit" } as const;

/** Open findings on an item, tinted by the worst one; "—" when there are none or it is not graded. */
export function FindingsCell({ count, severity }: FindingsCellProps) {
  if (!count) return <span className="dt-num muted">{EMPTY_MARK}</span>;
  const word = severity ? SEVERITY_WORD[severity] : "warning";
  return (
    <span
      className="dt-findings"
      data-severity={severity ?? "mid"}
      aria-label={`${count} finding${count === 1 ? "" : "s"}, worst ${word}`}
    >
      {count}
    </span>
  );
}
```

In `cells.css`, reuse the tone tokens `--tone-error-tint/-fg` (hi), `--tone-stale-tint/-fg` (mid) and `--tone-never-tint/-fg` (lo):

```css
.dt-findings { display: inline-block; min-width: 18px; padding: 1px 6px; border-radius: 5px;
  font-size: 11px; font-weight: 600; text-align: center; font-variant-numeric: tabular-nums; }
.dt-findings[data-severity="hi"] { background: var(--tone-error-tint); color: var(--tone-error-fg); }
.dt-findings[data-severity="mid"] { background: var(--tone-stale-tint); color: var(--tone-stale-fg); }
.dt-findings[data-severity="lo"] { background: var(--tone-never-tint); color: var(--tone-never-fg); }
```

Export `FindingsCell` from `cells/index.ts` and from `DataTable/index.ts`, next to `TokensCell`. Add `Findings` stories (`none`, `critical`, `warning`, `nit`) to `Cells.stories.tsx`. Add the three pairs to `cells.contrast.test.ts` using its existing helper; each must be ≥ 4.5.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/components/DataTable/cells`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DataTable
git commit -m "feat(tables): Findings cell — count tinted by the worst finding (#S2)"
```

### Task 2.4: One column set for every kind

**Files:**
- Create: `src/screens/Setup/setup.unified.tsx`
- Test: `src/screens/Setup/setup.unified.test.tsx`
- Modify: `src/components/DataTable/cells/TokensCell.tsx` + `cells.types.ts` (`approx?: boolean` renders a leading `≈`)

**Interfaces:**
- Consumes: `nameColumn`, `usesColumn`, `lastUsedColumn`, `errorRateColumn`, `COLUMN_WIDTH`, `scopeLabel`, `ColumnsCtx` (all from `setup.columns.tsx`); `KIND_SINGULAR`, `KindFilter` (Task 1.1); `SetupRow` (2.2); `FindingsCell` (2.3).
- Produces:
  - `USAGE_KINDS: ReadonlySet<ArtifactKind>` (skill, agent, command, mcp_server)
  - `BYTES_PER_TOKEN = 4`
  - `visibleColumnIds(kind: KindFilter, rows: SetupRow[], lens: boolean): string[]`
  - `unifiedColumns(ids: string[], ctx: ColumnsCtx): ColumnDef<SetupRow, unknown>[]` (cached on `ctx` + joined ids)

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/Setup/setup.unified.test.tsx
import { describe, expect, it } from "vitest";
import type { SetupRow } from "./setupRows.util";
import { unifiedColumns, visibleColumnIds } from "./setup.unified";

const row = (over: Partial<SetupRow>): SetupRow => ({
  id: 1, harness: "claude_code", layer: "global", kind: "skill", name: "x", path: "/x", plugin_name: null,
  description: null, bytes: 400, grade: null, score: null, file_id: null, usage: null, issue_count: null,
  worst_severity: null, origin: "inventory", project_label: null, project_path: null, load_order: null, ...over,
});

describe("visibleColumnIds", () => {
  it("shows Kind only on the All chip", () => {
    expect(visibleColumnIds("all", [row({})], false)).toContain("kind");
    expect(visibleColumnIds("skill", [row({})], false)).not.toContain("kind");
  });

  it("hides usage columns when no row in the slice can have usage", () => {
    const ids = visibleColumnIds("settings", [row({ kind: "settings" })], false);
    expect(ids).not.toContain("uses");
    expect(ids).not.toContain("errorRate");
    expect(ids).not.toContain("lastUsed");
  });

  it("keeps Findings whenever an instruction is in the slice", () => {
    expect(visibleColumnIds("all", [row({ kind: "rule" })], false)).toContain("findings");
    expect(visibleColumnIds("skill", [row({})], false)).not.toContain("findings");
  });

  it("adds the load-order column only under the lens, and only when instructions are shown", () => {
    expect(visibleColumnIds("all", [row({ kind: "rule" })], true)[0]).toBe("order");
    expect(visibleColumnIds("all", [row({ kind: "rule" })], false)).not.toContain("order");
    expect(visibleColumnIds("skill", [row({})], true)).not.toContain("order");
  });

  it("always has Name, Scope and Tokens", () => {
    for (const k of ["all", "rule", "hook", "plugin"] as const) {
      const ids = visibleColumnIds(k, [row({ kind: k === "all" ? "skill" : k })], false);
      expect(ids).toEqual(expect.arrayContaining(["name", "scope", "tokens"]));
    }
  });
});

describe("unifiedColumns", () => {
  it("returns the same array for the same ctx and ids", () => {
    const ctx = { onOpen: () => {}, projectNames: new Map() };
    const ids = ["name", "scope"];
    expect(unifiedColumns(ids, ctx)).toBe(unifiedColumns(["name", "scope"], ctx));
  });

  it("estimates an instruction's tokens from its size", () => {
    const ctx = { onOpen: () => {}, projectNames: new Map() };
    const tokens = unifiedColumns(["tokens"], ctx)[0];
    const accessor = (tokens as { accessorFn: (r: SetupRow) => number }).accessorFn;
    expect(accessor(row({ kind: "rule", bytes: 4000 }))).toBe(1000);
    expect(accessor(row({ kind: "skill", usage: { avg_turn_tokens: 7300 } as SetupRow["usage"] }))).toBe(7300);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/screens/Setup/setup.unified.test.tsx`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```tsx
// src/screens/Setup/setup.unified.tsx
import type { ColumnDef } from "@tanstack/react-table";
import type { ArtifactKind } from "@/lib/ipc";
import { EMPTY_MARK, FindingsCell, ScopeCell, TokensCell } from "@/components/DataTable";
import { KIND_SINGULAR, type KindFilter } from "@/lib/vocabulary";
import {
  COLUMN_WIDTH, errorRateColumn, lastUsedColumn, nameColumn, scopeLabel, usesColumn, type ColumnsCtx,
} from "./setup.columns";
import { projectNameFor } from "./setup.util";
import type { SetupRow } from "./setupRows.util";

/** Kinds the usage index counts (skills, agents, commands, MCP servers) — hooks are not among them. */
export const USAGE_KINDS: ReadonlySet<ArtifactKind> = new Set(["skill", "agent", "command", "mcp_server"]);

/** A rough, labelled (≈) estimate: an instruction file is paid for by its size, every session. */
export const BYTES_PER_TOKEN = 4;

const ORDER = ["order", "name", "kind", "scope", "uses", "errorRate", "tokens", "lastUsed", "findings"] as const;

/** Which columns the current slice can fill (spec §4.4). */
export function visibleColumnIds(kind: KindFilter, rows: SetupRow[], lens: boolean): string[] {
  const kinds = new Set(rows.map((r) => r.kind));
  const hasUsage = [...kinds].some((k) => USAGE_KINDS.has(k));
  const hasInstructions = kinds.has("rule");
  return ORDER.filter((id) => {
    if (id === "order") return lens && hasInstructions;
    if (id === "kind") return kind === "all";
    if (id === "uses" || id === "errorRate" || id === "lastUsed") return hasUsage;
    if (id === "findings") return hasInstructions;
    return true;
  });
}

function tokensOf(r: SetupRow): number {
  if (r.kind === "rule") return r.bytes > 0 ? Math.round(r.bytes / BYTES_PER_TOKEN) : -1;
  return r.usage?.avg_turn_tokens ?? -1;
}

function build(id: string, ctx: ColumnsCtx): ColumnDef<SetupRow, unknown> {
  const onlyUsage = (r: { kind: ArtifactKind }) => USAGE_KINDS.has(r.kind);
  switch (id) {
    case "order":
      return {
        id: "order", header: "#", meta: { align: "right", width: "44px" },
        accessorFn: (r) => r.load_order ?? Number.MAX_SAFE_INTEGER,
        cell: (c) => <span className="dt-num muted">{c.row.original.load_order ?? ""}</span>,
      };
    case "name":
      return nameColumn() as ColumnDef<SetupRow, unknown>;
    case "kind":
      return {
        id: "kind", header: "Kind", meta: { width: COLUMN_WIDTH.kind },
        accessorFn: (r) => KIND_SINGULAR[r.kind],
        cell: (c) => <span className="muted">{KIND_SINGULAR[c.row.original.kind]}</span>,
      };
    case "scope":
      return {
        id: "scope", header: "Scope", meta: { width: COLUMN_WIDTH.scope },
        accessorFn: (r) => scopeLabel(r, ctx.projectNames),
        cell: (c) => (
          <ScopeCell
            layer={c.row.original.layer}
            projectName={c.row.original.project_label ?? projectNameFor(c.row.original.path, ctx.projectNames)}
            pluginName={c.row.original.plugin_name}
          />
        ),
      };
    case "uses":
      return usesColumn(onlyUsage) as ColumnDef<SetupRow, unknown>;
    case "errorRate":
      return { ...(errorRateColumn() as ColumnDef<SetupRow, unknown>), header: "Errors" };
    case "tokens":
      return {
        id: "tokens", header: "Tokens", meta: { align: "right", width: COLUMN_WIDTH.avgTokens },
        accessorFn: tokensOf,
        cell: (c) => {
          const v = tokensOf(c.row.original);
          return v < 0 ? <span className="dt-num muted">{EMPTY_MARK}</span> : <TokensCell value={v} approx={c.row.original.kind === "rule"} />;
        },
      };
    case "lastUsed":
      return lastUsedColumn(onlyUsage) as ColumnDef<SetupRow, unknown>;
    case "findings":
      return {
        id: "findings", header: "Findings", meta: { align: "right", width: "84px" },
        accessorFn: (r) => r.issue_count ?? -1,
        cell: (c) => <FindingsCell count={c.row.original.issue_count} severity={c.row.original.worst_severity} />,
      };
    default:
      throw new Error(`unknown Setup column ${id}`);
  }
}

const cache = new WeakMap<ColumnsCtx, Map<string, ColumnDef<SetupRow, unknown>[]>>();

/** The columns for `ids`, identity-stable per `ctx` (DataTable needs stable columns). */
export function unifiedColumns(ids: string[], ctx: ColumnsCtx): ColumnDef<SetupRow, unknown>[] {
  let byKey = cache.get(ctx);
  if (!byKey) {
    byKey = new Map();
    cache.set(ctx, byKey);
  }
  const key = ids.join("|");
  let defs = byKey.get(key);
  if (!defs) {
    defs = ids.map((id) => build(id, ctx));
    byKey.set(key, defs);
  }
  return defs;
}
```

`TokensCell`: add `approx?: boolean` to `TokensCellProps`, and render `{approx && text !== EMPTY_MARK ? "≈" : ""}{text}`. Add a `cells.test.tsx` case: `<TokensCell value={1000} approx />` has text `≈1,000`. If `formatTokens` renders `1.0k`, assert on that output instead: read `cells.util.ts#formatTokens` and match it.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup/setup.unified.test.tsx src/components/DataTable/cells`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Setup/setup.unified.tsx src/screens/Setup/setup.unified.test.tsx src/components/DataTable/cells
git commit -m "feat(setup): one column set for every kind, hidden where no row can fill it (#S2)"
```

### Task 2.5: KindChips

**Files:**
- Create: `src/components/KindChips/{index.ts,KindChips.tsx,KindChips.types.ts,KindChips.css,KindChips.test.tsx,KindChips.stories.tsx}`

**Interfaces:**
- Consumes: `KIND_CHIP_ORDER`, `KIND_LABEL`, `LABEL`, `KindFilter` (Task 1.1).
- Produces: `KindChips({ counts: Partial<Record<KindFilter, number>>, active: KindFilter, onChange: (k: KindFilter) => void })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/KindChips/KindChips.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { KindChips } from "./KindChips";

const counts = { all: 12, rule: 3, skill: 9, agent: 0 };

describe("KindChips", () => {
  it("renders every chip in the spec's order, with its count", () => {
    render(<KindChips counts={counts} active="all" onChange={vi.fn()} />);
    const names = screen.getAllByRole("radio").map((b) => b.textContent);
    expect(names).toEqual([
      "All12", "Instructions3", "Skills9", "Agents0", "Commands0", "MCP servers0", "Hooks0", "Plugins0", "Config0",
    ]);
  });

  it("disables a chip with nothing in it instead of hiding it", () => {
    render(<KindChips counts={counts} active="all" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /Agents/ })).toBeDisabled();
  });

  it("selects one kind at a time", () => {
    const onChange = vi.fn();
    render(<KindChips counts={counts} active="all" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /All/ })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Skills/ }));
    expect(onChange).toHaveBeenCalledWith("skill");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<KindChips counts={counts} active="skill" onChange={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

Before writing this, check how other suites import axe (`grep -rn "vitest-axe\|jest-axe" src | head -2`) and use the same import.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/KindChips`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// KindChips.types.ts
import type { KindFilter } from "@/lib/vocabulary";
export interface KindChipsProps {
  /** Items per chip in the current view; a missing kind counts 0. */
  counts: Partial<Record<KindFilter, number>>;
  active: KindFilter;
  onChange: (kind: KindFilter) => void;
}
```

```tsx
// KindChips.tsx
import { KIND_CHIP_ORDER, KIND_LABEL, LABEL } from "@/lib/vocabulary";
import type { KindChipsProps } from "./KindChips.types";
import "./KindChips.css";

/**
 * The kinds as a single-select radio group. A kind with no items is shown
 * disabled rather than hidden, so the row never reflows between projects.
 */
export function KindChips({ counts, active, onChange }: KindChipsProps) {
  return (
    <div className="kind-chips" role="radiogroup" aria-label="Kinds">
      {KIND_CHIP_ORDER.map((kind) => {
        const count = counts[kind] ?? 0;
        const on = kind === active;
        return (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={count === 0 && !on}
            className={"kind-chip" + (on ? " kind-chip--on" : "")}
            onClick={() => onChange(kind)}
          >
            {kind === "all" ? LABEL.all : KIND_LABEL[kind]}
            <span className="kind-chip__count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
```

`KindChips.css` sets 24px-tall pills with 12px radius, a 1px `var(--sep-strong)` border, and `var(--card)` background. The on state uses a `var(--blue)` border, `var(--blue-tint)` fill and `var(--blue-press)` text. Disabled is `opacity: .45`. The count is `var(--text-2)`, tabular. `index.ts` exports `KindChips` and `KindChipsProps`. Stories: `AllSelected`, `OneKind`, `EmptyKinds`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/components/KindChips`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/KindChips
git commit -m "feat(ui): KindChips — single-select kinds with counts (#S2)"
```

### Task 2.6: SummaryLine (grade badge + counts + three filters)

**Files:**
- Create: `src/components/SummaryLine/{index.ts,SummaryLine.tsx,SummaryLine.types.ts,SummaryLine.constants.ts,SummaryLine.css,SummaryLine.test.tsx,SummaryLine.stories.tsx}`

**Interfaces:**
- Consumes: `SetupFilter` from `src/screens/Setup/setup.util.ts` (`"all" | "never" | "errors" | "cost"`).
- Produces: `SummaryLine({ grade: Grade | null, items: number, counts: Record<"never"|"errors"|"cost", number>, active: SetupFilter, onFilter: (f: SetupFilter) => void, badge?: ReactNode })`. `badge` replaces the static grade chip; Part 3 passes the popover trigger.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SummaryLine/SummaryLine.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SummaryLine } from "./SummaryLine";

const base = { grade: "C" as const, items: 84, counts: { never: 3, errors: 1, cost: 0 }, active: "all" as const };

describe("SummaryLine", () => {
  it("reads grade, item count, and only the non-zero filters", () => {
    render(<SummaryLine {...base} onFilter={vi.fn()} />);
    expect(screen.getByText("C")).toBeInTheDocument();
    expect(screen.getByText("84 items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3 never used" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 erroring" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /costly/ })).toBeNull();
  });

  it("toggles a filter on, and off again", () => {
    const onFilter = vi.fn();
    const { rerender } = render(<SummaryLine {...base} onFilter={onFilter} />);
    fireEvent.click(screen.getByRole("button", { name: "3 never used" }));
    expect(onFilter).toHaveBeenLastCalledWith("never");
    rerender(<SummaryLine {...base} active="never" onFilter={onFilter} />);
    expect(screen.getByRole("button", { name: "3 never used" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "3 never used" }));
    expect(onFilter).toHaveBeenLastCalledWith("all");
  });

  it("keeps an active filter visible even when its count drops to zero", () => {
    render(<SummaryLine {...base} counts={{ never: 0, errors: 0, cost: 0 }} active="errors" onFilter={vi.fn()} />);
    expect(screen.getByRole("button", { name: "0 erroring" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says 1 item in the singular and shows no badge before the first scan", () => {
    render(<SummaryLine {...base} grade={null} items={1} onFilter={vi.fn()} />);
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.queryByText("C")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/SummaryLine`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// SummaryLine.constants.ts
export const FILTER_WORD = { never: "never used", errors: "erroring", cost: "costly" } as const;
```

```ts
// SummaryLine.types.ts
import type { ReactNode } from "react";
import type { Grade } from "@/lib/ipc";
import type { SetupFilter } from "@/screens/Setup/setup.util";
export interface SummaryLineProps {
  grade: Grade | null;
  items: number;
  counts: Record<Exclude<SetupFilter, "all">, number>;
  active: SetupFilter;
  onFilter: (filter: SetupFilter) => void;
  /** Replaces the static grade chip (the popover trigger, Part 3). */
  badge?: ReactNode;
}
```

```tsx
// SummaryLine.tsx
import { FILTER_WORD } from "./SummaryLine.constants";
import type { SummaryLineProps } from "./SummaryLine.types";
import "./SummaryLine.css";

const FILTERS = ["never", "errors", "cost"] as const;

/** `[C] 84 items · 3 never used · 1 erroring · 2 costly` — each count a toggle filter (spec §4.2). */
export function SummaryLine({ grade, items, counts, active, onFilter, badge }: SummaryLineProps) {
  return (
    <div className="summary-line">
      {badge ?? (grade && <span className={`summary-grade grade-tint--${grade.toLowerCase()}`}>{grade}</span>)}
      <span>{items} {items === 1 ? "item" : "items"}</span>
      {FILTERS.filter((f) => counts[f] > 0 || active === f).map((f) => (
        <button
          key={f}
          type="button"
          className={`summary-filter summary-filter--${f}`}
          aria-pressed={active === f}
          onClick={() => onFilter(active === f ? "all" : f)}
        >
          {counts[f]} {FILTER_WORD[f]}
        </button>
      ))}
    </div>
  );
}
```

CSS: `.summary-line` is flex, 8px gap, `var(--text-2)`. Filter pills are 22px, radius 11px. `errors` uses `--tone-error-tint/-fg` and `cost` uses `--tone-stale-tint/-fg`. `[aria-pressed=true]` adds a 1.5px solid `currentColor` border. `grade-tint--*` classes already exist (`ProjectGlyph`); reuse them. Stories: `WithFilters`, `FilterActive`, `NoScanYet`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/components/SummaryLine`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/SummaryLine
git commit -m "feat(ui): SummaryLine — grade, item count and three toggle filters (#S2)"
```

### Task 2.7: Setup deep-link target

**Files:**
- Create: `src/App/setupTarget.ts`
- Test: `src/App/setupTarget.test.ts`

**Interfaces:**
- Produces:
  - `type StatusFilter = "never" | "errors" | "cost"`
  - `type ViewerTab = "content" | "findings" | "usage"`
  - `type ItemRef = { artifactId: number } | { fileId: string }`
  - `interface SetupTarget { kind?: KindFilter; filter?: StatusFilter; lens?: string; open?: ItemRef; tab?: ViewerTab }`
  - `parseSetupTarget(raw: string | null | undefined): SetupTarget`
  - `formatSetupTarget(t: SetupTarget): string | undefined` (undefined when empty)

- [ ] **Step 1: Write the failing test**

```ts
// src/App/setupTarget.test.ts
import { describe, expect, it } from "vitest";
import { formatSetupTarget, parseSetupTarget } from "./setupTarget";

describe("setup target", () => {
  it("still reads a bare kind, the way the panel and Analytics link today", () => {
    expect(parseSetupTarget("mcp_server")).toEqual({ kind: "mcp_server" });
  });

  it("round-trips every field", () => {
    const t = { kind: "skill", filter: "never", lens: "/code/web app", open: { fileId: "/code/web app/CLAUDE.md" }, tab: "findings" } as const;
    expect(parseSetupTarget(formatSetupTarget(t))).toEqual(t);
  });

  it("round-trips an artifact id", () => {
    expect(parseSetupTarget(formatSetupTarget({ open: { artifactId: 12 } }))).toEqual({ open: { artifactId: 12 } });
  });

  it("drops values it does not know instead of guessing", () => {
    expect(parseSetupTarget("kind=nonsense&filter=loud&tab=raw&open=a:x")).toEqual({});
    expect(parseSetupTarget(undefined)).toEqual({});
    expect(parseSetupTarget("nonsense")).toEqual({});
  });

  it("formats an empty target as nothing", () => {
    expect(formatSetupTarget({})).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/App/setupTarget.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/App/setupTarget.ts
import { KIND_CHIP_ORDER, type KindFilter } from "@/lib/vocabulary";

export type StatusFilter = "never" | "errors" | "cost";
export type ViewerTab = "content" | "findings" | "usage";
export type ItemRef = { artifactId: number } | { fileId: string };

/** Everything a link into Setup can ask for (spec §10); every field optional. */
export interface SetupTarget {
  kind?: KindFilter;
  filter?: StatusFilter;
  lens?: string;
  open?: ItemRef;
  tab?: ViewerTab;
}

const FILTERS: readonly StatusFilter[] = ["never", "errors", "cost"];
const TABS: readonly ViewerTab[] = ["content", "findings", "usage"];
const isKind = (v: string | null): v is KindFilter => v !== null && (KIND_CHIP_ORDER as readonly string[]).includes(v);

/**
 * A Setup deep link as a query string (`kind=skill&filter=never&lens=…&open=a:12&tab=findings`),
 * so it survives the panel → main-window `navigate` event, which carries a
 * plain string. A bare kind (`"mcp_server"`) is still accepted — that is what
 * links sent before this format looked like.
 */
export function parseSetupTarget(raw: string | null | undefined): SetupTarget {
  if (!raw) return {};
  if (!raw.includes("=")) return isKind(raw) ? { kind: raw } : {};
  const q = new URLSearchParams(raw);
  const out: SetupTarget = {};
  const kind = q.get("kind");
  if (isKind(kind)) out.kind = kind;
  const filter = q.get("filter");
  if (filter && (FILTERS as readonly string[]).includes(filter)) out.filter = filter as StatusFilter;
  const lens = q.get("lens");
  if (lens) out.lens = lens;
  const open = q.get("open");
  if (open?.startsWith("a:") && /^-?\d+$/.test(open.slice(2))) out.open = { artifactId: Number(open.slice(2)) };
  else if (open?.startsWith("f:") && open.length > 2) out.open = { fileId: open.slice(2) };
  const tab = q.get("tab");
  if (tab && (TABS as readonly string[]).includes(tab)) out.tab = tab as ViewerTab;
  return out;
}

export function formatSetupTarget(t: SetupTarget): string | undefined {
  const q = new URLSearchParams();
  if (t.kind) q.set("kind", t.kind);
  if (t.filter) q.set("filter", t.filter);
  if (t.lens) q.set("lens", t.lens);
  if (t.open) q.set("open", "artifactId" in t.open ? `a:${t.open.artifactId}` : `f:${t.open.fileId}`);
  if (t.tab) q.set("tab", t.tab);
  const s = q.toString();
  return s.length > 0 ? s : undefined;
}
```

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/App/setupTarget.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App/setupTarget.ts src/App/setupTarget.test.ts
git commit -m "feat(ui): Setup deep links carry kind, filter, lens, open item and tab (#S2)"
```

### Task 2.8: The Setup screen: one table, chips, summary, graded rows

**Files:**
- Modify: `src/screens/Setup/Setup.tsx` (the `Inventory` + `KindTable` pair become one `Inventory`)
- Modify: `src/screens/Setup/Setup.types.ts` (`initialTab?: ArtifactKind` → `target?: SetupTarget`)
- Modify: `src/screens/Setup/useSetup.ts` (also loads `commands.listFiles()`; exposes `files: FileRow[]`)
- Modify: `src/screens/Setup/setup.pills.ts` (export `scopePillsFor(rows: SetupRow[], projectNames)`, the Scope group over mixed kinds; `pillsFor` stays for the Project screen until Part 5)
- Create: `src/screens/Setup/useOverallGrade.ts` (+ `useOverallGrade.test.ts`)
- Modify: `src/screens/Setup/Setup.constants.ts` (`TABLE_STATE_KEY = "setup.unified"`, `EMPTY_FILTERED`, `NEW_FROM_TEMPLATE = "New from template…"`)
- Modify: `src/screens/Setup/Setup.test.tsx`, `Setup.stories.tsx`
- Modify: `src/App/App.tsx` (pass `target={parseSetupTarget(setupTargetRaw)}` instead of `initialTab`; drop `isKindTab` + the `KIND_TABS` import)

**Interfaces:**
- Consumes: `setupRows` (2.2), `visibleColumnIds`/`unifiedColumns` (2.4), `KindChips` (2.5), `SummaryLine` (2.6), `SetupTarget` (2.7), `applyFilter`/`filterCounts`/`costThreshold`/`projectNameMap` (existing), `TemplatePicker`/`useTemplatePicker` (existing).
- Produces:
  - `SetupProps { navigate; data?: SetupView | null; files?: FileRow[]; target?: SetupTarget }`
  - `useOverallGrade(): { grade: Grade | null; loading: boolean }`

- [ ] **Step 1: Write the failing tests** (replace the tab-strip tests in `Setup.test.tsx`; keep the empty/error-state tests)

```tsx
// src/screens/Setup/Setup.test.tsx — new cases (reuse the file's existing fixtures/`view()` helper; add `files`)
it("shows one table with kind chips instead of tabs", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.getByRole("radiogroup", { name: "Kinds" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: /^All/ })).toHaveAttribute("aria-checked", "true");
});

it("narrows to one kind from a chip and from a deep link", () => {
  const { rerender } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
  fireEvent.click(screen.getByRole("radio", { name: /Skills/ }));
  expect(screen.queryByRole("columnheader", { name: /Kind/ })).toBeNull();
  rerender(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ kind: "mcp_server" }} />);
  expect(screen.getByRole("radio", { name: /MCP servers/ })).toHaveAttribute("aria-checked", "true");
});

it("filters to never-used items from the summary line", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /never used/ }));
  for (const row of screen.getAllByRole("row").slice(1)) expect(row).not.toHaveTextContent(/^adapt/);
});

it("lists a graded file the inventory never saw under Instructions", () => {
  const orphan = { id: "/x/AGENTS.md", name: "AGENTS.md", path: "/x/AGENTS.md", project: "x", project_id: "/x",
    kind: "AGENTS.md", grade: "D", score: 55, issue_count: 4, modified: null, worst_severity: "hi" } as FileRow;
  render(<Setup navigate={vi.fn()} data={fixture} files={[orphan]} />);
  fireEvent.click(screen.getByRole("radio", { name: /Instructions/ }));
  expect(screen.getByText("AGENTS.md")).toBeInTheDocument();
  expect(screen.getByLabelText("4 findings, worst critical")).toBeInTheDocument();
});

it("offers New from template… on the Instructions chip only", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
  expect(screen.queryByRole("button", { name: "New from template…" })).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: /Instructions/ }));
  expect(screen.getByRole("button", { name: "New from template…" })).toBeInTheDocument();
});
```

```ts
// src/screens/Setup/useOverallGrade.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getOverview: vi.fn(async () => ({ status: "ok", data: { has_data: true, overall_grade: "B" } })) },
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
import { useOverallGrade } from "./useOverallGrade";

describe("useOverallGrade", () => {
  it("reads the grade, and none before the first scan", async () => {
    const { result } = renderHook(() => useOverallGrade());
    await waitFor(() => expect(result.current.grade).toBe("B"));
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Setup/Setup.test.tsx src/screens/Setup/useOverallGrade.test.ts`
Expected: FAIL. The `files` and `target` props don't exist yet, the tabs still render, and `useOverallGrade` is missing.

- [ ] **Step 3: Implement**

```ts
// src/screens/Setup/useOverallGrade.ts
import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type Grade } from "@/lib/ipc";

/** The whole setup's grade for the summary badge; `null` before the first scan. Refetches on `scan-done`. */
export function useOverallGrade(): { grade: Grade | null; loading: boolean } {
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState(isTauri);
  const load = useCallback(async () => {
    if (!isTauri) return;
    const res = await commands.getOverview();
    setGrade(res.status === "ok" && res.data.has_data ? res.data.overall_grade : null);
    setLoading(false);
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!isTauri) return;
    const off = listen("scan-done", () => void load());
    return () => void off.then((fn) => fn());
  }, [load]);
  return { grade, loading };
}
```

`useSetup.ts`: fetch `commands.listFiles()` alongside `getSetup()` in the same `Promise.all`, and keep `files` in state (empty on failure). Return `{ data, files, loading, refetch }`, and add `files: FileRow[]` to `SetupState`.

`setup.pills.ts`: export a mixed-kind Scope group:

```ts
/** The Scope filter over rows of every kind (Setup's single table). */
export function scopePillsFor(rows: ArtifactView[], projectNames: Map<string, string>): PillGroup<ArtifactView>[] {
  // `scopeGroup` gates on SCOPED_KINDS per kind; over a mixed table every
  // scoped row counts, so call it with a scoped kind and let the rows decide.
  const group = scopeGroup("skill", rows.filter((r) => SCOPED_KINDS.has(r.kind)), projectNames);
  return group ? [group] : [];
}
```

`Setup.tsx`: rewrite `Inventory`. Delete `KindTable`, `findRow`, `TAB_IDS` and the `Tabs` import. The new body:

```tsx
function Inventory({ data, files, detected, navigate, target, onRefetch }: InventoryProps) {
  const projectNames = useMemo(() => projectNameMap(data.projects), [data]);
  const rows = useMemo(() => setupRows(data, files), [data, files]);
  const costBar = useMemo(() => costThreshold(rows), [rows]);
  const [kind, setKind] = useState<KindFilter>(target?.kind ?? "all");
  const [filter, setFilter] = useState<SetupFilter>(target?.filter ?? "all");
  useEffect(() => { if (target?.kind) setKind(target.kind); }, [target?.kind]);
  useEffect(() => { if (target?.filter) setFilter(target.filter); }, [target?.filter]);

  const openDetail = useCallback((fileId: string) => navigate("detail", fileId), [navigate]);
  const ctx = useMemo<ColumnsCtx>(() => ({ onOpen: openDetail, projectNames }), [openDetail, projectNames]);

  const kindCounts = useMemo(() => {
    const out: Partial<Record<KindFilter, number>> = { all: rows.length };
    for (const r of rows) out[r.kind] = (out[r.kind] ?? 0) + 1;
    return out;
  }, [rows]);
  const ofKind = useMemo(() => (kind === "all" ? rows : rows.filter((r) => r.kind === kind)), [rows, kind]);
  const counts = useMemo(() => filterCounts(ofKind, costBar), [ofKind, costBar]);
  const visible = useMemo(() => applyFilter(ofKind, filter, costBar) as SetupRow[], [ofKind, filter, costBar]);
  const columns = unifiedColumns(visibleColumnIds(kind, visible.length > 0 ? visible : ofKind, false), ctx);
  const pills = useMemo(() => scopePillsFor(ofKind, projectNames), [ofKind, projectNames]);
  const { grade } = useOverallGrade();
  const templates = useTemplatePicker();
  const [picking, setPicking] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const open = openId === null ? null : (rows.find((r) => r.id === openId) ?? null);

  const onRowClick = (row: SetupRow) => {
    // Until the viewer gains its Findings tab (Part 3), a graded file still opens Detail.
    if (row.kind === "rule" && row.file_id) openDetail(row.file_id);
    else setOpenId(row.id);
  };

  return (
    <>
      <SummaryLine grade={grade} items={ofKind.length} counts={{ never: counts.never, errors: counts.errors, cost: counts.cost }}
        active={filter} onFilter={setFilter} />
      <DataTable
        ariaLabel="Setup"
        stateKey={TABLE_STATE_KEY}
        columns={columns}
        rows={visible}
        rowId={(r) => String(r.id)}
        search={search /* existing keys, typed SetupRow */}
        pills={pills}
        defaultSort={{ id: "kind", desc: false }}
        onRowClick={onRowClick}
        density="compact"
        virtualize
        empty={{ title: EMPTY_FILTERED, hint: EMPTY_HINT }}
        toolbarRight={
          <>
            <KindChips counts={kindCounts} active={kind} onChange={setKind} />
            {kind === "rule" && (
              <Button size="sm" onClick={() => setPicking(true)}>{NEW_FROM_TEMPLATE}</Button>
            )}
          </>
        }
      />
      {picking && (
        <TemplatePicker templates={templates.templates} entitled={templates.entitled} loading={templates.loading}
          onApply={templates.applyTemplate} onClose={() => setPicking(false)} navigate={navigate} />
      )}
      {/* sheets: exactly as today, keyed on `open` (SkillPanel for skills, ArtifactPanel otherwise) */}
    </>
  );
}
```

The `KindChips` sit above the table, not inside the toolbar, if `DataTable`'s toolbar wraps badly at 1024px. Check with the Storybook story; the chips are one row and must not scroll sideways. The wiring matches `Prompts.tsx:69,142-150`: `useTemplatePicker()` returns `{ templates, entitled, loading, applyTemplate }`, and loads on mount. The default sort "kind" needs the Kind column to exist. When a single kind is selected, pass `defaultSort={{ id: kind === "all" ? "kind" : "name", desc: false }}`.

`Setup.constants.ts`: add `TABLE_STATE_KEY = "setup.unified"`, `EMPTY_FILTERED = "No items match"`, `NEW_FROM_TEMPLATE = "New from template…"`, `NO_HARNESS_TITLE = "No Claude Code setup found"` (spec §4.5). `NoHarness` uses that title and a `LABEL.addFolder` button. Add a Setup test asserting both for a view whose harnesses are all undetected. Remove `TAB_STATE_KEY`, `TABLE_STATE_PREFIX` and `EMPTY_TITLE` once nothing imports them (grep).

`App.tsx`: keep the raw string in state (`const [setupTarget, setSetupTarget] = useState<string | undefined>()`). In `navigate`, set it for `next === "setup"`, and render `<Setup navigate={navigate} target={parseSetupTarget(setupTarget)} />`. Memoise the parse with `useMemo` so the object is stable across renders. Delete `isKindTab` and the `KIND_TABS` import.

Stories (`Setup.stories.tsx`): `AllItems`, `OneKind` (target `{kind:"skill"}`), `NeverUsedFilter`, `WithGradedOnlyFiles`, `NoHarness`, `Unreadable`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup src/App`
Expected: PASS. `App.test.tsx`'s old "setup opens on a kind tab" case now asserts `propsOf("setup").target` equals `{ kind: "mcp_server" }`.

- [ ] **Step 5: Commit**

```bash
git add -A src/screens/Setup src/App
git commit -m "feat(setup): one table with kind chips, summary filters and graded files; templates move here from Prompts (#S2)"
```

### Task 2.9: Setup is home; Part 2 gate

**Files:**
- Modify: `src/App/App.tsx:32` (`useState<Route>("setup")`) and `finishOnboarding` (`setRoute("setup")`)
- Modify: `src/components/Sidebar/Sidebar.constants.ts` (order: Setup, Overview, Projects, Scans, Analytics, Settings; Prompts removed from the sidebar; `NAV_OWNER.detail = "setup"`)
- Modify: `src/components/Sidebar/useSidebar.ts` (drop the `prompts` count and `listFiles`)
- Test: `src/App/App.test.tsx`, `src/components/Sidebar/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// App.test.tsx
it("opens on Setup", () => {
  render(<App />);
  expect(screen.getByTestId("setup")).toBeInTheDocument();
});
```

```tsx
// Sidebar.test.tsx
it("leads with Setup and no longer lists Prompts", () => {
  render(<Sidebar active="setup" onNavigate={vi.fn()} />);
  const labels = screen.getAllByRole("button").map((b) => b.textContent);
  expect(labels[0]).toBe("Setup");
  expect(labels).not.toContain("Prompts");
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/App src/components/Sidebar`
Expected: FAIL (the app opens on Overview, and Prompts is still listed).

- [ ] **Step 3: Implement** the four edits listed under **Files**.

- [ ] **Step 4: Part 2 gate**

Run: `pnpm check`
Expected: `✔ all gates passed`. The app opens on Setup; the chips replace the tabs; the three filters work; graded-only files show under Instructions.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(ui): Setup is the home screen; Prompts leaves the sidebar (#S2)"
```

---
# Part 3: Viewer tabs, editing, grade popover (closes #S3)

### Task 3.1: Backend: agents, commands and markdown instructions become editable

**Files:**
- Modify: `src-tauri/src/artifact_source.rs:85` (`EDITABLE_KINDS`), `editable_path` (≈line 131), and the `editable:` computation in `read_source` (≈line 198)
- Test: same file's test module (rename `an_agent_reads_as_markdown_but_is_not_editable`)

**Interfaces:**
- Produces: `read_source(..).editable` is true for `skill | agent | command`, and for `rule` only when the file is markdown (`.md`/`.mdc`). Every other kind is false. Saving follows the same rule.

- [ ] **Step 1: Write the failing tests**

```rust
#[test]
fn an_agent_reads_as_editable_markdown() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("reviewer.md");
    std::fs::write(&path, "---\nname: reviewer\n---\nReview.").unwrap();
    let conn = test_conn();
    let id = insert_artifact(&conn, "agent", path.to_str().unwrap());
    let source = read_source(&conn, id).unwrap();
    assert_eq!(source.format, SourceFormat::Markdown);
    assert!(source.editable);
}

#[test]
fn a_markdown_instruction_file_is_editable() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("CLAUDE.md");
    std::fs::write(&path, "# Rules\n").unwrap();
    let conn = test_conn();
    let id = insert_artifact(&conn, "rule", path.to_str().unwrap());
    assert!(read_source(&conn, id).unwrap().editable);
}

#[test]
fn a_cursorrules_instruction_file_stays_read_only() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join(".cursorrules");
    std::fs::write(&path, "be nice").unwrap();
    let conn = test_conn();
    let id = insert_artifact(&conn, "rule", path.to_str().unwrap());
    assert!(!read_source(&conn, id).unwrap().editable);
    assert!(editable_path(&conn, id).is_err());
}

#[test]
fn a_settings_file_is_never_editable() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("settings.json");
    std::fs::write(&path, "{}").unwrap();
    let conn = test_conn();
    let id = insert_artifact(&conn, "settings", path.to_str().unwrap());
    assert!(editable_path(&conn, id).is_err());
}
```

Delete `an_agent_reads_as_markdown_but_is_not_editable`; its contract changed on purpose.

- [ ] **Step 2: Run them and watch them fail**

Run: `cd src-tauri && cargo test --lib artifact_source::`
Expected: FAIL. Agents and rules are not editable yet.

- [ ] **Step 3: Implement**

```rust
/// The artifact kinds this module will write. `rule` only when the file is
/// markdown: a `.cursorrules` or other plain-text rule file has no edit view
/// worth offering, and every kind added is a new file the app can overwrite.
const EDITABLE_KINDS: &[&str] = &["skill", "agent", "command", "rule"];

/// Whether this row's file may be written from the viewer.
fn is_editable(kind: &str, path: &str) -> bool {
    EDITABLE_KINDS.contains(&kind) && (kind != "rule" || format_of(path) == SourceFormat::Markdown)
}
```

`editable_path`: replace the `EDITABLE_KINDS.contains` check with `if !is_editable(kind.as_str(), &path)`. In `read_source`, compute `editable: is_editable(row.kind.as_str(), &path)`, using the variable names that are actually in scope there. Check what `format_of` returns for `.mdc`. If it returns `Text`, extend `format_of` to treat `mdc` as markdown and add a test for it.

- [ ] **Step 4: Run and pass**

Run: `cd src-tauri && cargo test --lib artifact_source:: && cargo clippy --all-targets -- -D warnings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/artifact_source.rs
git commit -m "feat(engine): agents, commands and markdown instruction files can be edited from the viewer (#S3)"
```

### Task 3.2: Backend: per-item usage (`get_artifact_usage`)

**Files:**
- Create: `src-tauri/src/item_usage.rs`
- Modify:
  - `src-tauri/src/lib.rs`: `mod item_usage;`
  - `src-tauri/src/commands.rs`: the wrapper, next to `get_project_usage`
  - `src-tauri/src/command_names.rs`: add `"get_artifact_usage"` after `"get_project_usage"`
  - `src-tauri/src/ipc.rs`: `crate::commands::get_artifact_usage` in `collect_commands!` at the same position
  - `src-tauri/capabilities/default.json`: add `"allow-get-artifact-usage"`
- Regenerate: `src/lib/bindings.ts`

**Interfaces:**
- Produces:
  - Rust: `pub fn artifact_usage(conn, artifact_id: i32, now_epoch_secs: i64, window_days: u32) -> rusqlite::Result<ArtifactUsage>`
  - Rust: `pub struct ArtifactUsage { window_days: u32, per_day: Vec<UsageDay>, by_project: Vec<ProjectUses>, avg_turn_tokens: Option<f64> }`
  - Rust: `UsageDay { day: String, uses: u32, errors: u32 }`
  - Rust: `ProjectUses { path: String, name: String, uses: u32, sessions: u32 }`
  - TS: `commands.getArtifactUsage(artifactId: number, windowDays: number)` → `ArtifactUsage`

- [ ] **Step 1: Write the failing test** (in `item_usage.rs`)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    /// One artifact, three invocations over two days in two projects, one of them an error.
    fn seeded() -> (rusqlite::Connection, i32) {
        let conn = test_conn();
        conn.execute(
            "INSERT INTO artifacts(harness, layer, project_path, kind, name, path, bytes, hash, seen_at)
             VALUES('claude_code', 'global', NULL, 'skill', 'adapt', '/h/adapt/SKILL.md', 0, 'h', '2026-09-01T00:00:00Z')",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid() as i32;
        for (ts, project, session, err, tokens) in [
            ("2026-09-25T10:00:00Z", "/code/web", "s1", 0, 1000),
            ("2026-09-25T11:00:00Z", "/code/web", "s1", 1, 3000),
            ("2026-09-26T09:00:00Z", "/code/api", "s2", 0, 2000),
        ] {
            insert_invocation(&conn, id, ts, project, session, err, tokens);
        }
        (conn, id)
    }

    /// 2026-09-27T00:00:00Z
    const NOW: i64 = 1_790_467_200;

    #[test]
    fn counts_uses_and_errors_per_day_zero_filled() {
        let (conn, id) = seeded();
        let u = artifact_usage(&conn, id, NOW, 3).unwrap();
        assert_eq!(u.window_days, 3);
        let days: Vec<_> = u.per_day.iter().map(|d| (d.day.as_str(), d.uses, d.errors)).collect();
        assert_eq!(days, vec![("2026-09-25", 2, 1), ("2026-09-26", 1, 0), ("2026-09-27", 0, 0)]);
    }

    #[test]
    fn splits_uses_by_project_busiest_first() {
        let (conn, id) = seeded();
        let u = artifact_usage(&conn, id, NOW, 30).unwrap();
        let split: Vec<_> = u.by_project.iter().map(|p| (p.name.as_str(), p.uses, p.sessions)).collect();
        assert_eq!(split, vec![("web", 2, 1), ("api", 1, 1)]);
    }

    #[test]
    fn averages_tokens_over_the_window() {
        let (conn, id) = seeded();
        assert_eq!(artifact_usage(&conn, id, NOW, 30).unwrap().avg_turn_tokens, Some(2000.0));
    }

    #[test]
    fn an_unused_artifact_has_a_flat_series_and_no_projects() {
        let (conn, _) = seeded();
        let u = artifact_usage(&conn, 9_999, NOW, 7).unwrap();
        assert_eq!(u.per_day.len(), 7);
        assert!(u.per_day.iter().all(|d| d.uses == 0));
        assert!(u.by_project.is_empty());
        assert_eq!(u.avg_turn_tokens, None);
    }

    #[test]
    fn the_window_is_capped_at_a_year() {
        let (conn, id) = seeded();
        assert_eq!(artifact_usage(&conn, id, NOW, 10_000).unwrap().per_day.len(), 366);
    }
}
```

The helper, written against the real `invocations` table (`src-tauri/src/store.rs:209`). `session_id` has no foreign key, and `tool_use_id` must be unique per session:

```rust
fn insert_invocation(conn: &rusqlite::Connection, artifact_id: i32, ts: &str, project: &str, session: &str, is_error: i64, tokens: i64) {
    conn.execute(
        "INSERT INTO invocations(harness, session_id, tool_use_id, project_path, ts, tool_name, kind, target, artifact_id, is_error, turn_tokens)
         VALUES('claude_code', ?1, ?2, ?3, ?4, 'Skill', 'skill', 'adapt', ?5, ?6, ?7)",
        rusqlite::params![session, format!("{session}-{ts}"), project, ts, artifact_id, is_error, tokens],
    )
    .unwrap();
}
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd src-tauri && cargo test --lib item_usage::`
Expected: compile error (module missing).

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/item_usage.rs
//! One item's usage over a window: uses and errors per day, and which projects
//! used it — the viewer's Usage tab (spec §6.3). Counts every invocation that
//! resolved to the artifact, sub-agent ones included (the work happened).

use std::collections::HashMap;

use rusqlite::{params, Connection};

use crate::harness_query::{last_component, window_calendar_days};

/// The longest daily series: a year and a leap day.
const MAX_WINDOW_DAYS: u32 = 366;

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct UsageDay {
    /// `YYYY-MM-DD`, UTC.
    pub day: String,
    pub uses: u32,
    pub errors: u32,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ProjectUses {
    pub path: String,
    pub name: String,
    pub uses: u32,
    pub sessions: u32,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, specta::Type)]
pub struct ArtifactUsage {
    pub window_days: u32,
    /// Oldest day first, zero-filled.
    pub per_day: Vec<UsageDay>,
    /// Busiest project first.
    pub by_project: Vec<ProjectUses>,
    pub avg_turn_tokens: Option<f64>,
}

fn as_u32(v: i64) -> u32 {
    v.clamp(0, u32::MAX as i64) as u32
}

pub fn artifact_usage(
    conn: &Connection,
    artifact_id: i32,
    now_epoch_secs: i64,
    window_days: u32,
) -> rusqlite::Result<ArtifactUsage> {
    let window_days = window_days.clamp(1, MAX_WINDOW_DAYS);
    let days = window_calendar_days(now_epoch_secs, window_days);
    let since = format!("{}T00:00:00Z", days[0]);

    let mut per_day_stmt = conn.prepare(
        "SELECT substr(ts, 1, 10) AS day, count(*), sum(is_error)
           FROM invocations WHERE artifact_id = ?1 AND ts >= ?2 GROUP BY day",
    )?;
    let mut by_day: HashMap<String, (u32, u32)> = HashMap::new();
    for row in per_day_stmt.query_map(params![artifact_id, since], |r| {
        Ok((r.get::<_, String>(0)?, as_u32(r.get(1)?), as_u32(r.get::<_, Option<i64>>(2)?.unwrap_or(0))))
    })? {
        let (day, uses, errors) = row?;
        by_day.insert(day, (uses, errors));
    }
    let per_day = days
        .into_iter()
        .map(|day| {
            let (uses, errors) = by_day.get(&day).copied().unwrap_or((0, 0));
            UsageDay { day, uses, errors }
        })
        .collect();

    let mut proj_stmt = conn.prepare(
        "SELECT rtrim(project_path, '/'), count(*), count(DISTINCT session_id)
           FROM invocations WHERE artifact_id = ?1 AND ts >= ?2
          GROUP BY rtrim(project_path, '/') ORDER BY count(*) DESC, 1",
    )?;
    let by_project = proj_stmt
        .query_map(params![artifact_id, since], |r| {
            let path: String = r.get(0)?;
            Ok(ProjectUses { name: last_component(&path), path, uses: as_u32(r.get(1)?), sessions: as_u32(r.get(2)?) })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let avg_turn_tokens: Option<f64> = conn.query_row(
        "SELECT avg(turn_tokens) FROM invocations WHERE artifact_id = ?1 AND ts >= ?2",
        params![artifact_id, since],
        |r| r.get(0),
    )?;

    Ok(ArtifactUsage { window_days, per_day, by_project, avg_turn_tokens })
}
```

`window_calendar_days` is already `pub(crate)` in `harness_query.rs`, and `last_component` is `pub(crate)`. Both are usable here.

Command wrapper in `commands.rs`, mirroring `get_project_usage`:

```rust
/// One item's usage over `window_days`, for the viewer's Usage tab.
#[tauri::command]
#[specta::specta]
pub fn get_artifact_usage(
    db: tauri::State<'_, AppDb>,
    artifact_id: i32,
    window_days: u32,
) -> Result<crate::item_usage::ArtifactUsage, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let now = crate::scan::now_epoch().parse::<i64>().unwrap_or(0);
    crate::item_usage::artifact_usage(&conn, artifact_id, now, window_days).map_err(|e| e.to_string())
}
```

Add `ArtifactUsage`, `UsageDay` and `ProjectUses` to the type re-export list in `src/lib/ipc.ts` after regenerating.

- [ ] **Step 4: Run and pass (ACL tests included)**

Run: `cd src-tauri && cargo test --lib && cargo test --test capabilities && cargo test --lib ipc::tests::export_typescript_bindings && cargo clippy --all-targets -- -D warnings`
Expected: PASS, including `every_command_is_granted_to_some_window` and `the_acl_command_list_matches_what_the_invoke_handler_registers`.

- [ ] **Step 5: Commit**

```bash
git add -A src-tauri src/lib
git commit -m "feat(engine): get_artifact_usage — uses and errors per day and per project for one item (#S3)"
```

### Task 3.3: Backend: reveal/open a graded file, reveal a project folder

Graded-only rows (Task 2.2) have no artifact id, so `open_artifact` cannot serve them. The lens strip (Part 4) needs to reveal a project folder. Both take an id the database already knows and never a free path, the same security boundary as `open_artifact`.

**Files:**
- Create: `src-tauri/src/file_open.rs`
- Modify:
  - `src-tauri/src/lib.rs`: `mod file_open;`
  - `src-tauri/src/commands.rs`: two wrappers after `open_artifact`
  - `src-tauri/src/command_names.rs`: `"open_file"`, `"reveal_project"` after `"open_artifact"`
  - `src-tauri/src/ipc.rs`: the matching `collect_commands!` entries
  - `src-tauri/capabilities/default.json`: `"allow-open-file"`, `"allow-reveal-project"`
- Regenerate: `src/lib/bindings.ts`

**Interfaces:**
- Produces:
  - Rust: `pub fn graded_file_path(conn, file_id: &str) -> Result<String, String>`
  - Rust: `pub fn project_folder(conn, project_path: &str) -> Result<String, String>`
  - TS: `commands.openFile(fileId: string, action: OpenAction)`
  - TS: `commands.revealProject(projectPath: string)`

- [ ] **Step 1: Write the failing tests** (in `file_open.rs`)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::test_conn;

    fn graded(conn: &rusqlite::Connection, id: &str) {
        conn.execute("INSERT INTO projects(id, name, root_path) VALUES('/code/app', 'app', '/code/app')", []).unwrap();
        conn.execute(
            "INSERT INTO files(id, project_id, path, kind) VALUES(?1, '/code/app', ?1, 'AGENTS.md')",
            [id],
        )
        .unwrap();
    }

    #[test]
    fn a_graded_file_resolves_to_its_own_path() {
        let conn = test_conn();
        graded(&conn, "/code/app/AGENTS.md");
        assert_eq!(graded_file_path(&conn, "/code/app/AGENTS.md").unwrap(), "/code/app/AGENTS.md");
    }

    #[test]
    fn an_unknown_file_id_is_refused() {
        let conn = test_conn();
        assert!(graded_file_path(&conn, "/etc/passwd").is_err());
    }

    #[test]
    fn a_known_project_folder_resolves_from_either_table() {
        let conn = test_conn();
        graded(&conn, "/code/app/AGENTS.md");
        assert_eq!(project_folder(&conn, "/code/app/").unwrap(), "/code/app");
        conn.execute("INSERT INTO harness_projects(harness, path, exists_on_disk) VALUES('claude_code', '/code/web', 1)", []).unwrap();
        assert_eq!(project_folder(&conn, "/code/web").unwrap(), "/code/web");
    }

    #[test]
    fn an_unknown_folder_is_refused() {
        let conn = test_conn();
        assert!(project_folder(&conn, "/Users").is_err());
    }
}
```

`harness_projects` needs only `harness` and `path`; the other columns default (`store.rs:157`).

- [ ] **Step 2: Run them and watch them fail**

Run: `cd src-tauri && cargo test --lib file_open::`
Expected: compile error.

- [ ] **Step 3: Implement**

```rust
// src-tauri/src/file_open.rs
//! Reveal or open things the scan found that have no artifact row: a graded
//! file from an extra scan folder, and a project folder. Each takes an id the
//! database already holds — never a path from the webview — so granting these
//! commands does not grant "open anything on disk".

use rusqlite::{Connection, OptionalExtension};

/// The graded file's path, if `file_id` is one the grader recorded.
pub fn graded_file_path(conn: &Connection, file_id: &str) -> Result<String, String> {
    conn.query_row("SELECT path FROM files WHERE id = ?1", [file_id], |r| r.get::<_, String>(0))
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "That file is no longer in the scan.".to_string())
}

/// The project folder, if some harness or the grader knows it as a project.
pub fn project_folder(conn: &Connection, project_path: &str) -> Result<String, String> {
    let wanted = project_path.trim_end_matches('/');
    conn.query_row(
        "SELECT rtrim(path, '/') FROM harness_projects WHERE rtrim(path, '/') = ?1
         UNION SELECT rtrim(root_path, '/') FROM projects WHERE rtrim(root_path, '/') = ?1 LIMIT 1",
        [wanted],
        |r| r.get::<_, String>(0),
    )
    .optional()
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "That folder is not a scanned project.".to_string())
}
```

Wrappers in `commands.rs`, mirroring `open_artifact`, including its text-only rule for Open:

```rust
/// Reveal or open a graded file that has no inventory row.
#[tauri::command]
#[specta::specta]
pub fn open_file(
    app: tauri::AppHandle,
    db: tauri::State<'_, AppDb>,
    file_id: String,
    action: crate::artifact_source::OpenAction,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        crate::file_open::graded_file_path(&conn, &file_id)?
    };
    let opener = app.opener();
    match action {
        crate::artifact_source::OpenAction::Reveal => opener.reveal_item_in_dir(&path),
        crate::artifact_source::OpenAction::Open => {
            if !crate::artifact_source::opens_as_text(&path) {
                return Err("Only text files open from here — use Reveal to find this one in Finder.".to_string());
            }
            opener.open_path(&path, None::<&str>)
        }
    }
    .map_err(|e| format!("Couldn't open {path}: {e}"))
}

/// Select a scanned project's folder in Finder.
#[tauri::command]
#[specta::specta]
pub fn reveal_project(
    app: tauri::AppHandle,
    db: tauri::State<'_, AppDb>,
    project_path: String,
) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        crate::file_open::project_folder(&conn, &project_path)?
    };
    app.opener().reveal_item_in_dir(&path).map_err(|e| format!("Couldn't reveal {path}: {e}"))
}
```

- [ ] **Step 4: Run and pass**

Run: `cd src-tauri && cargo test --lib && cargo test --test capabilities && cargo test --lib ipc::tests::export_typescript_bindings && cargo clippy --all-targets -- -D warnings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src-tauri src/lib/bindings.ts
git commit -m "feat(engine): open_file and reveal_project, validated against what the scan recorded (#S3)"
```

### Task 3.4: CodeView and FileViewer can jump to a line

**Files:**
- Modify: `src/components/CodeView/CodeView.tsx`, `CodeView.types.ts`, `CodeView.css`, `CodeView.test.tsx`, `CodeView.stories.tsx`
- Modify: `src/components/FileViewer/FileViewer.tsx`, `FileViewer.types.ts`, `useFileViewer.ts`, `FileViewer.test.tsx`, `FileViewer.stories.tsx`

**Interfaces:**
- Produces:
  - `CodeViewProps.focusLine?: number | null`: 1-based. That line scrolls into view (`block: "center"`) and gets the class `cv__line--focus`.
  - `FileViewerProps.focusLine?: number | null`: while set, the viewer shows Source whatever the mode preference was, and passes the line to CodeView.

- [ ] **Step 1: Write the failing tests**

```tsx
// CodeView.test.tsx (add)
it("marks and scrolls to the focused line", () => {
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  const { container } = render(<CodeView content={"a\nb\nc"} language={null} ariaLabel="x" focusLine={2} />);
  const lines = container.querySelectorAll(".cv__line");
  expect(lines[1]).toHaveClass("cv__line--focus");
  expect(lines[0]).not.toHaveClass("cv__line--focus");
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
});
```

```tsx
// FileViewer.test.tsx (add)
it("switches a rendered markdown file to Source when asked to show a line", () => {
  const { rerender } = render(<FileViewer name="CLAUDE.md" content={"# A\nB"} format="markdown" path="/x/CLAUDE.md" loading={false} error={null} />);
  expect(screen.queryByRole("region", { name: /source/i })).toBeNull();
  rerender(<FileViewer name="CLAUDE.md" content={"# A\nB"} format="markdown" path="/x/CLAUDE.md" loading={false} error={null} focusLine={2} />);
  expect(screen.getByRole("region", { name: /source/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/components/CodeView src/components/FileViewer`
Expected: FAIL (unknown prop, no focus class).

- [ ] **Step 3: Implement**

`CodeView.tsx`: accept `focusLine`. Keep a `useRef<HTMLDivElement | null>` for the focused row, and set it via a callback ref only on the row where `i + 1 === focusLine`. Add `useEffect(() => focusedRef.current?.scrollIntoView({ block: "center" }), [focusLine])`. Add `" cv__line--focus"` to that row's className. Keep the `memo`, whose props now include `focusLine`. In CSS, `.cv__line--focus { background: var(--blue-tint); }`.

`useFileViewer(format, searchable, initialMode, forceSource?: boolean)`: when `forceSource` is true, the resolved `mode` is `"source"`. `FileViewer` passes `focusLine != null` as `forceSource` and `focusLine` to `CodeView`. Add a `FocusedLine` story to both components.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/components/CodeView src/components/FileViewer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/CodeView src/components/FileViewer
git commit -m "feat(ui): the file viewer can open on a given line (#S3)"
```

### Task 3.5: DataTable reports the rows on screen, in order

The viewer's ⌘↑/⌘↓ must step through what the user sees, which is after their sort, search and scope filter.

**Files:**
- Modify: `src/components/DataTable/DataTable.tsx`, `DataTable.types.ts`, `DataTable.test.tsx`

**Interfaces:**
- Produces: `DataTableProps.onVisibleRowsChange?: (ids: string[]) => void`. It is called with the sorted, filtered row ids whenever that list changes.

- [ ] **Step 1: Write the failing test**

```tsx
it("reports the visible row ids in sorted order", async () => {
  const onVisible = vi.fn();
  render(
    <DataTable ariaLabel="t" stateKey="t.visible" rows={[{ id: "b", n: 2 }, { id: "a", n: 1 }]}
      rowId={(r) => r.id} columns={[{ id: "n", header: "N", accessorKey: "n" }]}
      defaultSort={{ id: "n" }} empty={{ title: "none" }} onVisibleRowsChange={onVisible} />,
  );
  await waitFor(() => expect(onVisible).toHaveBeenLastCalledWith(["a", "b"]));
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/DataTable/DataTable.test.tsx -t "visible row ids"`
Expected: FAIL (never called).

- [ ] **Step 3: Implement.** In `DataTable.tsx`, after `modelRows` is computed:

```tsx
const visibleKey = modelRows.map((r) => r.id).join("\u0000");
useEffect(() => {
  onVisibleRowsChange?.(visibleKey.length > 0 ? visibleKey.split("\u0000") : []);
  // Keyed on the ids, not the array: a new array of the same rows is not a change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [visibleKey]);
```

Add the prop to `DataTableProps` with a doc comment and destructure it.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/components/DataTable`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/DataTable
git commit -m "feat(tables): DataTable reports the rows on screen, in order (#S3)"
```

### Task 3.6: Findings tab (Detail's findings and fixes move into the viewer)

**Files:**
- Create: `src/screens/Setup/Findings/`, holding:
  - `index.ts`, `Findings.tsx`, `Findings.types.ts`, `Findings.constants.ts`, `Findings.css`, `Findings.test.tsx`, `Findings.stories.tsx`;
  - `IssueActions.tsx` (Detail's `IssuePanel`), `FixDiff.tsx`, `AiChecks.tsx` (Detail's `NlRulesPanel`, with its test moved alongside as `AiChecks.test.tsx`);
  - `fixActions.ts` (moved from `src/screens/Detail/fixActions.ts`) and `useFindings.ts`;
  - `findings.util.ts` + `findings.util.test.ts`.
- Modify: `src/screens/Detail/Detail.tsx` and `useFileDetail.ts` import `fixActions`, `IssueActions`, `FixDiff` and `AiChecks` from `@/screens/Setup/Findings`. Detail keeps working until Part 5 deletes it.

**Interfaces:**
- Consumes: `commands.getFileDetail`, `getAiConfig`, `getEntitlement`, `suggestFix`, `applyFix`, `undoFix`, `hasBackup`, `evaluateNlRules`; `isUnlocked` (Task 1.2).
- Produces:
  - `Findings({ fileId: string | null; onJumpToLine: (line: number) => void; onChanged?: () => void })`. With `fileId === null` it renders the ungraded message.
  - `useFindings(fileId: string | null): { detail: FileDetail | null; loading: boolean; aiReady: boolean; entitled: boolean; reload: () => Promise<void> }`
  - `weakestTwo(dims: DimensionScore[]): string`
  - `fixableEdits(detail: FileDetail): FixEdit[]`

- [ ] **Step 1: Write the failing tests**

```ts
// src/screens/Setup/Findings/findings.util.test.ts
import { describe, expect, it } from "vitest";
import type { FileDetail } from "@/lib/ipc";
import { fixableEdits, weakestTwo } from "./findings.util";

describe("findings.util", () => {
  it("names the two lowest dimensions, ties in their fixed order", () => {
    expect(weakestTwo([
      { dimension: "Clarity", score: 80 }, { dimension: "Consistency", score: 40 },
      { dimension: "Structure", score: 40 }, { dimension: "Examples", score: 90 }, { dimension: "Format", score: 70 },
    ])).toBe("Consistency & Structure");
  });

  it("collects only findings that carry a deterministic fix", () => {
    const detail = { issues: [
      { fix_from: "npm", fix_to: "pnpm" }, { fix_from: null, fix_to: null }, { fix_from: "a", fix_to: null },
    ] } as unknown as FileDetail;
    expect(fixableEdits(detail)).toEqual([{ from: "npm", to: "pnpm" }]);
  });
});
```

```tsx
// src/screens/Setup/Findings/Findings.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
const detail = {
  id: "/x/CLAUDE.md", name: "CLAUDE.md", project: "x", path: "/x/CLAUDE.md", grade: "C", score: 70, content: "a\nb",
  delta: null, dimensions: [{ dimension: "Clarity", score: 50 }, { dimension: "Consistency", score: 60 },
    { dimension: "Structure", score: 90 }, { dimension: "Examples", score: 90 }, { dimension: "Format", score: 90 }],
  issues: [
    { line: 2, severity: "hi", source: "anthropic", title: "Wrong package manager", why: "Repo uses pnpm", fix_from: "npm", fix_to: "pnpm" },
    { line: null, severity: "lo", source: "custom", title: "No examples", why: "Add one", fix_from: null, fix_to: null },
  ],
};
vi.mock("./useFindings", () => ({
  useFindings: (id: string | null) => ({ detail: id ? detail : null, loading: false, aiReady: false, entitled: true, reload: vi.fn() }),
}));
import { Findings } from "./Findings";

describe("Findings", () => {
  it("shows the scorecard strip and every finding", () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    expect(screen.getByText("C · 70")).toBeInTheDocument();
    expect(screen.getByText(/Weakest on Clarity & Consistency/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wrong package manager/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /No examples/ })).toBeInTheDocument();
  });

  it("jumps to the clicked finding's line — the one clicked, not the first", () => {
    const onJump = vi.fn();
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={onJump} />);
    fireEvent.click(screen.getByRole("button", { name: /Wrong package manager/ }));
    expect(onJump).toHaveBeenCalledWith(2);
    expect(screen.getByText("Repo uses pnpm")).toBeInTheDocument();
  });

  it("offers Fix all automatically when a finding carries a fix", () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Fix all automatically (1)" })).toBeInTheDocument();
  });

  it("says an item that is not an instruction file is not graded", () => {
    render(<Findings fileId={null} onJumpToLine={vi.fn()} />);
    expect(screen.getByText("Not graded. Checks run on instruction files only.")).toBeInTheDocument();
  });

  it("never shows purchase copy", () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    expect(screen.queryByText(/\$69|Get Pro|License/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Setup/Findings`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```bash
mkdir -p src/screens/Setup/Findings
git mv src/screens/Detail/fixActions.ts src/screens/Setup/Findings/fixActions.ts
git mv src/screens/Detail/NlRulesPanel.tsx src/screens/Setup/Findings/AiChecks.tsx
git mv src/screens/Detail/NlRulesPanel.test.tsx src/screens/Setup/Findings/AiChecks.test.tsx
```

In `AiChecks.tsx`, rename `NlRulesPanel` to `AiChecks` and relabel "standards" to "AI checks" (button "Run AI checks"). Fix its test's import and labels.

```ts
// src/screens/Setup/Findings/findings.util.ts
import type { DimensionScore, FileDetail, FixEdit } from "@/lib/ipc";

/** The two lowest-scoring dimensions joined with " & "; ties keep the fixed order. */
export function weakestTwo(dims: DimensionScore[]): string {
  return [...dims]
    .map((d, i) => ({ ...d, i }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, 2)
    .map((d) => d.dimension)
    .join(" & ");
}

/** Every deterministic fix on the file, as the edits `apply_fix` takes. */
export function fixableEdits(detail: FileDetail): FixEdit[] {
  return detail.issues
    .filter((i) => i.fix_from && i.fix_to)
    .map((i) => ({ from: i.fix_from as string, to: i.fix_to as string }));
}
```

`useFindings.ts`: copy `useFileDetail` from `src/screens/Detail/useFileDetail.ts`, dropping `useMergePosition` and the `mergePosition` return field. Use `setEntitled(isUnlocked(...))` and `useState(isUnlocked(undefined))` (Task 1.2).

`IssueActions.tsx`: move `IssuePanel` (Detail.tsx ≈lines 318–340+) and its `FixDiff` helper (into `FixDiff.tsx`) out of `Detail.tsx` unchanged, except for the rename `IssuePanel` → `IssueActions` and the `PAYMENTS_ENABLED` gating from Task 1.2 that is already on it. Export both from `index.ts`. `Detail.tsx` then imports `IssueActions` and `FixDiff` from `@/screens/Setup/Findings`.

```ts
// Findings.constants.ts
export const NOT_GRADED = "Not graded. Checks run on instruction files only.";
export const FIX_ALL = (n: number) => `Fix all automatically (${n})`;
export const NO_FINDINGS = "No findings on this file.";
```

```tsx
// src/screens/Setup/Findings/Findings.tsx
import { useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { SeverityDot } from "@/components/SeverityDot";
import { SourceBadge } from "@/components/SourceBadge";
import { AiChecks } from "./AiChecks";
import { applyFix } from "./fixActions";
import { FIX_ALL, NO_FINDINGS, NOT_GRADED } from "./Findings.constants";
import type { FindingsProps } from "./Findings.types";
import { fixableEdits, weakestTwo } from "./findings.util";
import { IssueActions } from "./IssueActions";
import { useFindings } from "./useFindings";
import "./Findings.css";

/** The viewer's Findings tab: everything Detail did, in one column (spec §6.2). */
export function Findings({ fileId, onJumpToLine, onChanged }: FindingsProps) {
  const { detail, loading, aiReady, entitled, reload } = useFindings(fileId);
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (fileId === null) return <p className="muted findings__empty">{NOT_GRADED}</p>;
  if (loading) return <p className="muted findings__empty">Loading…</p>;
  if (!detail) return <p className="muted findings__empty">{NOT_GRADED}</p>;

  const edits = fixableEdits(detail);
  const refresh = async () => {
    await reload();
    onChanged?.();
  };
  const fixAll = async () => {
    setBusy(true);
    setError(null);
    const r = await applyFix(detail.id, edits, false, "auto");
    if (r.ok) await refresh();
    else setError(r.message);
    setBusy(false);
  };

  return (
    <div className="findings">
      <div className="findings__score">
        <span className={`findings__grade grade-fg--${detail.grade.toLowerCase()}`}>{detail.grade} · {detail.score}</span>
        <span className="muted">Weakest on {weakestTwo(detail.dimensions)}</span>
        <span className="toolbar-spacer" />
        {edits.length > 0 && (
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void fixAll()}>
            <Icon name="wand" /> {busy ? "Fixing…" : FIX_ALL(edits.length)}
          </Button>
        )}
      </div>
      {error && <p className="findings__error" role="alert">{error}</p>}
      {detail.issues.length === 0 ? (
        <p className="muted findings__empty">{NO_FINDINGS}</p>
      ) : (
        <ul className="findings__list">
          {detail.issues.map((issue, index) => (
            <li key={index}>
              <button
                type="button"
                className={"findings__item" + (selected === index ? " findings__item--on" : "")}
                aria-expanded={selected === index}
                onClick={() => {
                  setSelected(index);
                  if (issue.line != null) onJumpToLine(issue.line);
                }}
              >
                <SeverityDot level={issue.severity} />
                <span className="grow">{issue.title}</span>
                {issue.line != null && <span className="muted tnum">L{issue.line}</span>}
                <SourceBadge source={issue.source} />
              </button>
              {selected === index && (
                <IssueActions key={index} issue={issue} fileId={detail.id} index={index}
                  aiReady={aiReady} entitled={entitled} onReload={refresh} />
              )}
            </li>
          ))}
        </ul>
      )}
      {aiReady && <AiChecks fileId={detail.id} content={detail.content} onApplied={() => void refresh()} />}
    </div>
  );
}
```

```ts
// Findings.types.ts
export interface FindingsProps {
  /** The graded file's id; `null` for an item the grader never grades. */
  fileId: string | null;
  /** Show this 1-based line in the Content tab's Source view. */
  onJumpToLine: (line: number) => void;
  /** A fix landed; the table's Findings count should refresh. */
  onChanged?: () => void;
}
```

The first test expects "Repo uses pnpm" to show after clicking a finding. Check that `IssueActions` renders the finding's `why`; the current `IssuePanel` does. `Findings.css` holds a compact list with 32px rows and a 12px gap, using no card nesting. Stories: `WithFindings`, `Clean`, `NotGraded`, `Loading`. Each story mocks `useFindings` through a `findings` override prop. Add `findings?: FindingsState` to `FindingsProps` for stories only, the same pattern `Setup`'s `data` override uses.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup/Findings src/screens/Detail`
Expected: PASS. Detail still works on the moved pieces.

- [ ] **Step 5: Commit**

```bash
git add -A src/screens/Setup/Findings src/screens/Detail
git commit -m "feat(setup): Findings tab — scorecard, findings, fixes and AI checks move into the viewer (#S3)"
```

### Task 3.7: Usage tab

**Files:**
- Create: `src/screens/Setup/ItemUsage/{index.ts,ItemUsage.tsx,ItemUsage.types.ts,ItemUsage.constants.ts,ItemUsage.css,ItemUsage.test.tsx,ItemUsage.stories.tsx,useItemUsage.ts,useItemUsage.test.ts}`

**Interfaces:**
- Consumes: `commands.getArtifactUsage` (3.2), `TrendChart` (`data`, `xKey`, `dataKey`, `domain`, `height`, `ariaLabel`), `USAGE_KINDS` and `BYTES_PER_TOKEN` (2.4), `SetupRow` (2.2).
- Produces:
  - `ItemUsage({ item: SetupRow; loadedIn: { path: string; name: string }[]; onSelectProject: (path: string) => void; usage?: ArtifactUsage | null })`. The `usage` prop is a story override.
  - `useItemUsage(artifactId: number | null, windowDays: 30 | 90)`

- [ ] **Step 1: Write the failing test**

```tsx
// src/screens/Setup/ItemUsage/ItemUsage.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SetupRow } from "../setupRows.util";
import { ItemUsage } from "./ItemUsage";

const skill = { id: 4, kind: "skill", name: "adapt", bytes: 900, origin: "inventory", usage: { total: 3, sessions: 2,
  last_used: "2026-09-26T09:00:00Z", error_rate: 0.33, avg_turn_tokens: 2000, count_30d: 3, count_prev_30d: 0 } } as SetupRow;
const usage = {
  window_days: 30,
  per_day: [{ day: "2026-09-25", uses: 2, errors: 1 }, { day: "2026-09-26", uses: 1, errors: 0 }],
  by_project: [{ path: "/code/web", name: "web", uses: 2, sessions: 1 }, { path: "/code/api", name: "api", uses: 1, sessions: 1 }],
  avg_turn_tokens: 2000,
};

describe("ItemUsage", () => {
  it("shows the per-project split, each project switching the lens", () => {
    const onSelect = vi.fn();
    render(<ItemUsage item={skill} loadedIn={[]} onSelectProject={onSelect} usage={usage} />);
    fireEvent.click(screen.getByRole("button", { name: /web/ }));
    expect(onSelect).toHaveBeenCalledWith("/code/web");
  });

  it("shows average tokens per turn and last used", () => {
    render(<ItemUsage item={skill} loadedIn={[]} onSelectProject={vi.fn()} usage={usage} />);
    expect(screen.getByText(/2,000|2\.0k/)).toBeInTheDocument();
  });

  it("for an instruction file, shows its token cost and the projects that load it", () => {
    const rule = { ...skill, kind: "rule", bytes: 4000, usage: null } as SetupRow;
    render(<ItemUsage item={rule} loadedIn={[{ path: "/code/web", name: "web" }]} onSelectProject={vi.fn()} usage={null} />);
    expect(screen.getByText(/≈1,000 tokens|≈1\.0k tokens/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "web" })).toBeInTheDocument();
  });

  it("says a hook has no usage", () => {
    render(<ItemUsage item={{ ...skill, kind: "hook" } as SetupRow} loadedIn={[]} onSelectProject={vi.fn()} usage={null} />);
    expect(screen.getByText("No usage for this kind.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/screens/Setup/ItemUsage`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

`useItemUsage.ts`: `useState<ArtifactUsage | null>(null)` + `loading`. It calls `commands.getArtifactUsage(artifactId, windowDays)` when `artifactId !== null && artifactId > 0 && isTauri`, re-running on either input. It returns `{ usage, loading }`. Its test mocks `commands.getArtifactUsage` and asserts the call happens with `(4, 30)`. It also asserts that a synthetic (negative) id never calls it.

`ItemUsage.tsx`:
- `USAGE_KINDS.has(item.kind)`: render a 30/90 toggle (two `aria-pressed` buttons), then two `TrendChart`s:
  - uses per day, `xKey="day" dataKey="uses" domain={[0, "auto"]} ariaLabel="Uses per day"`;
  - errors per day, `dataKey="errors"`.
- Then the facts: avg tokens per turn via `formatTokens` from `@/components/DataTable/cells/cells.util`, and last used via `relativeTime`/`LastUsedCell`. Then a list of `by_project` rows, each a `<button>` naming the project with its uses, calling `onSelectProject(path)`.
- `item.kind === "rule"`: render `≈{formatTokens(Math.round(item.bytes / BYTES_PER_TOKEN))} tokens, loaded every session`, then "Loaded in" with one button per `loadedIn` entry.
- Otherwise: `NO_USAGE = "No usage for this kind."`

Whether the test finds "2,000" or "2.0k" depends on how `formatTokens` renders. Keep the regex alternatives as written.

Stories: `Skill30Days`, `Skill90Days`, `Instruction`, `NoUsageKind`, `Loading`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup/ItemUsage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Setup/ItemUsage
git commit -m "feat(setup): Usage tab — uses and errors over time, per-project split, instruction token cost (#S3)"
```

### Task 3.8: ItemViewer: one sheet with Content / Findings / Usage, editing and stepping

**Files:**
- Move: `src/screens/Setup/SkillPanel/` → `src/screens/Setup/ItemViewer/` (`git mv`, then rename `SkillPanel*` → `ItemViewer*`, `SkillPanelView` → `ItemViewerView`)
- Create in `ItemViewer/`: `ItemViewerTabs.tsx` (the tab strip), `useGradedSource.ts` (+ test), `itemViewer.util.ts` (+ test)
- Modify: `src/screens/Setup/FileActions/FileActions.tsx` + `.types.ts` (target: `{ artifactId } | { fileId }`)
- Delete: `src/screens/Setup/ArtifactPanel/`. `ItemViewer` covers read-only items, and its tests move into `ItemViewer.test.tsx`.

**Interfaces:**
- Consumes: `useArtifactSource(id)` (existing, `ArtifactSourceState`), `FileViewer` + `focusLine` (3.4), `Findings` (3.6), `ItemUsage` (3.7), `ArtifactMeta`, `FileActions`, `Sheet`, `SheetPath`, `DiscardConfirm` (existing), `ViewerTab` (2.7), `SetupRow` (2.2).
- Produces:
  - `ItemViewer({ item: SetupRow; scope: string; tab: ViewerTab; onTab: (t: ViewerTab) => void; onClose: () => void; onStep?: (delta: -1 | 1) => void; onSaved?: () => void; loadedIn: { path: string; name: string }[]; onSelectProject: (path: string) => void })`
  - `useGradedSource(fileId: string): ArtifactSourceState` (read-only: content from `getFileDetail`, format from the extension)
  - `stepTarget(ids: string[], current: string, delta: -1 | 1): string | null` (clamped, `null` when `current` is gone)

- [ ] **Step 1: Write the failing tests**

```ts
// src/screens/Setup/ItemViewer/itemViewer.util.test.ts
import { describe, expect, it } from "vitest";
import { stepTarget } from "./itemViewer.util";

describe("stepTarget", () => {
  const ids = ["3", "1", "7"];
  it("moves to the next and previous row in on-screen order", () => {
    expect(stepTarget(ids, "1", 1)).toBe("7");
    expect(stepTarget(ids, "1", -1)).toBe("3");
  });
  it("clamps at the ends", () => {
    expect(stepTarget(ids, "7", 1)).toBe("7");
    expect(stepTarget(ids, "3", -1)).toBe("3");
  });
  it("gives nothing when the open row is no longer on screen", () => {
    expect(stepTarget(ids, "9", 1)).toBeNull();
  });
});
```

```tsx
// src/screens/Setup/ItemViewer/ItemViewer.test.tsx (new cases; keep the moved SkillPanel editing cases)
it("opens on the requested tab and switches tabs", () => {
  const onTab = vi.fn();
  render(<ItemViewerView {...props} tab="content" onTab={onTab} />);
  fireEvent.click(screen.getByRole("tab", { name: "Findings" }));
  expect(onTab).toHaveBeenCalledWith("findings");
});

it("offers Edit only when the backend says the file is editable", () => {
  const { rerender } = render(<ItemViewerView {...props} source={{ ...source, editable: false }} />);
  expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
  rerender(<ItemViewerView {...props} source={{ ...source, editable: true }} />);
  expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
});

it("steps to the next and previous item with ⌘↓ and ⌘↑", () => {
  const onStep = vi.fn();
  render(<ItemViewerView {...props} onStep={onStep} />);
  fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
  fireEvent.keyDown(window, { key: "ArrowUp", metaKey: true });
  expect(onStep.mock.calls).toEqual([[1], [-1]]);
});

it("jumping to a finding shows its line in Content → Source", () => {
  render(<ItemViewerView {...props} tab="findings" item={{ ...props.item, kind: "rule", file_id: "/x/CLAUDE.md" }} />);
  // Findings is mocked in this file to call onJumpToLine(2) from a button:
  fireEvent.click(screen.getByRole("button", { name: "jump" }));
  expect(props.onTab).toHaveBeenCalledWith("content");
});

it("a save that hits a changed-on-disk conflict keeps the draft and shows the error", async () => {
  // reuse the moved SkillPanel conflict case verbatim, now with item.kind = "agent"
});
```

Finish the last case by copying the existing SkillPanel test that covers `CONFLICT_MARKER` ("changed on disk"), with the item kind set to `"agent"`. Shape `props`/`source` like the moved SkillPanel test's fixtures, adding `tab: "content"`, `onTab: vi.fn()`, `loadedIn: []`, `onSelectProject: vi.fn()`. At the top of the file, mock `../Findings` as `({ onJumpToLine }) => <button onClick={() => onJumpToLine(2)}>jump</button>` and mock `../ItemUsage` as a stub.

```ts
// src/screens/Setup/ItemViewer/useGradedSource.test.ts
it("reads a graded file's content read-only, markdown by extension", async () => {
  // commands.getFileDetail mocked to { status: "ok", data: { content: "# A", path: "/x/AGENTS.md", … } }
  const { result } = renderHook(() => useGradedSource("/x/AGENTS.md"));
  await waitFor(() => expect(result.current.content).toBe("# A"));
  expect(result.current.format).toBe("markdown");
  expect(result.current.editable).toBe(false);
  expect(await result.current.save("x")).toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Setup/ItemViewer`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```bash
git mv src/screens/Setup/SkillPanel src/screens/Setup/ItemViewer
cd src/screens/Setup/ItemViewer
for f in SkillPanel*; do git mv "$f" "${f/SkillPanel/ItemViewer}"; done
cd -
git rm -r src/screens/Setup/ArtifactPanel
```

```ts
// itemViewer.util.ts
/** The row `delta` away from `current` in on-screen order, clamped; `null` if `current` left the screen. */
export function stepTarget(ids: string[], current: string, delta: -1 | 1): string | null {
  const at = ids.indexOf(current);
  if (at < 0) return null;
  return ids[Math.min(ids.length - 1, Math.max(0, at + delta))];
}
```

```ts
// useGradedSource.ts
import { useCallback, useEffect, useState } from "react";
import { commands, isTauri, type SourceFormat } from "@/lib/ipc";
import type { ArtifactSourceState } from "../Setup.types";

const formatFor = (path: string): SourceFormat => (/\.(md|mdc)$/i.test(path) ? "markdown" : "text");

/** A graded file with no inventory row, read through its file detail. Read-only. */
export function useGradedSource(fileId: string): ArtifactSourceState {
  const [content, setContent] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const read = useCallback(async () => {
    if (!isTauri) return;
    setLoading(true);
    setError(null);
    const res = await commands.getFileDetail(fileId);
    if (res.status === "ok" && res.data) {
      setContent(res.data.content);
      setPath(res.data.path);
    } else setError(res.status === "ok" ? "That file is no longer in the scan." : res.error);
    setLoading(false);
  }, [fileId]);
  useEffect(() => void read(), [read]);
  return {
    content, path, format: path ? formatFor(path) : null, editable: false, modified: null,
    loading, saving: false, error, save: async () => null, reload: () => void read(),
  };
}
```

Check the `getFileDetail` binding's success type: `FileDetail | null`, per `bindings.ts:113`. The null branch above handles it.

`ItemViewer.tsx`, the container, picks the hook by origin. Hooks can't be conditional, so there are two thin components:

```tsx
export function ItemViewer(props: ItemViewerProps) {
  return props.item.origin === "graded" && props.item.file_id
    ? <GradedItemViewer {...props} fileId={props.item.file_id} />
    : <InventoryItemViewer {...props} />;
}
function InventoryItemViewer(props: ItemViewerProps) {
  return <ItemViewerView {...props} source={useArtifactSource(props.item.id)} />;
}
function GradedItemViewer({ fileId, ...props }: ItemViewerProps & { fileId: string }) {
  return <ItemViewerView {...props} source={useGradedSource(fileId)} />;
}
```

`ItemViewerView.tsx`, from `SkillPanelView`:
- rename `skill` to `item` (type `SetupRow`);
- render the Edit button only when `source.editable && tab === "content"`;
- keep the whole read/edit/discard flow as it is;
- add the tab strip under the `SheetPath` toolbar: `<ItemViewerTabs active={tab} onChange={onTab} findingsCount={item.issue_count} />`, using `role="tablist"` with three `role="tab"` buttons ("Content", "Findings", "Usage").

The body switches on `tab`:
- `content`: the existing `FileViewer`, with `focusLine={focusLine}`.
- `findings`: `<Findings fileId={item.kind === "rule" ? item.file_id : null} onJumpToLine={(l) => { setFocusLine(l); onTab("content"); }} onChanged={onSaved} />`
- `usage`: `<ItemUsage item={item} loadedIn={loadedIn} onSelectProject={onSelectProject} />`

`focusLine` is local state, cleared when the item changes (key the sheet on `item.id`, as today).

Add the header additions and step buttons:
- **"Loaded in N projects":** `ArtifactMeta` gets `loadedIn?: number` and appends ` · loaded in N projects` when `N > 1`.
- **Step buttons:** add ↑/↓ `Button size="icon"` controls, `aria-label` "Previous item"/"Next item", calling `onStep(-1|1)`. They render only when `onStep` is set.
- **Keyboard:** in `useEffect`, a window keydown for `metaKey && (ArrowUp|ArrowDown)` calls `onStep`. It is ignored while editing (`mode === "edit"`), so the textarea keeps its caret moves.

`FileActions`: change `artifactId: number` to `target: { artifactId: number } | { fileId: string }`. Reveal/Open call `commands.openArtifact(target.artifactId, action)` or `commands.openFile(target.fileId, action)`, and Copy is unchanged. Update `FileActions.test.tsx` with one case per target. `ItemViewerView` passes `item.origin === "graded" ? { fileId: item.file_id! } : { artifactId: item.id }`.

Stories (`ItemViewer.stories.tsx`): `SkillContent`, `SkillEditing`, `AgentEditable`, `McpReadOnly`, `InstructionFindings`, `InstructionUsage`, `GradedOnlyFile`, `ReadFailed`, `Loading`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup`
Expected: PASS. Setup.tsx still imports `SkillPanel`/`ArtifactPanel` until Task 3.9, so give this run `pnpm vitest run src/screens/Setup/ItemViewer src/screens/Setup/FileActions`, and do the full Setup run after 3.9.

- [ ] **Step 5: Commit**

```bash
git add -A src/screens/Setup
git commit -m "feat(setup): ItemViewer — one sheet with Content, Findings and Usage, editing where the backend allows, ⌘↑/⌘↓ stepping (#S3)"
```

### Task 3.9: Setup opens every row in the ItemViewer

**Files:**
- Modify: `src/screens/Setup/Setup.tsx` (Inventory: `openId` + `tab` state from `target.open`/`target.tab`, and `visibleIds` from `onVisibleRowsChange`)
- Modify: `src/screens/Setup/Setup.test.tsx`, `Setup.stories.tsx`

**Interfaces:**
- Consumes: `ItemViewer`, `stepTarget` (3.8), `onVisibleRowsChange` (3.5), `SetupTarget.open`/`.tab` (2.7).

- [ ] **Step 1: Write the failing tests**

```tsx
it("opens a graded instruction in the viewer instead of Detail", () => {
  const navigate = vi.fn();
  render(<Setup navigate={navigate} data={fixture} files={[]} />);
  fireEvent.click(screen.getByRole("radio", { name: /Instructions/ }));
  fireEvent.click(screen.getAllByRole("row")[1]);
  expect(navigate).not.toHaveBeenCalledWith("detail", expect.anything());
  expect(screen.getByRole("tablist", { name: /viewer/i })).toBeInTheDocument();
});

it("opens the item a deep link names, on the tab it names", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ open: { artifactId: SKILL_ID }, tab: "usage" }} />);
  expect(screen.getByRole("tab", { name: "Usage" })).toHaveAttribute("aria-selected", "true");
});

it("opens a file by its file id (the panel's Fix these next link)", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ open: { fileId: RULE_FILE_ID }, tab: "findings" }} />);
  expect(screen.getByRole("tab", { name: "Findings" })).toHaveAttribute("aria-selected", "true");
});

it("closes the viewer when a rescan removes the open item", () => {
  const { rerender } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ open: { artifactId: SKILL_ID } }} />);
  rerender(<Setup navigate={vi.fn()} data={withoutSkill} files={[]} target={{ open: { artifactId: SKILL_ID } }} />);
  expect(screen.queryByRole("tablist", { name: /viewer/i })).toBeNull();
});
```

`SKILL_ID`, `RULE_FILE_ID` and `withoutSkill` come from the file's existing fixture: pick a skill row's id and a rule row's `file_id`, and build `withoutSkill` by filtering that skill out of `fixture.global`. Mock `./ItemViewer/useGradedSource` and `./useArtifactSource` to return a loaded `ArtifactSourceState`, and `./Findings` and `./ItemUsage` as stubs, so these tests exercise Setup's wiring only.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Setup/Setup.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `Inventory`:

```tsx
const [openId, setOpenId] = useState<number | null>(null);
const [tab, setTab] = useState<ViewerTab>(target?.tab ?? "content");
const [visibleIds, setVisibleIds] = useState<string[]>([]);
// A deep link names an item by artifact id, or by file id (graded rows and the panel's fixes).
useEffect(() => {
  const want = target?.open;
  if (!want) return;
  const row = "artifactId" in want ? rows.find((r) => r.id === want.artifactId) : rows.find((r) => r.file_id === want.fileId);
  if (row) {
    setOpenId(row.id);
    setTab(target?.tab ?? "content");
  }
  // Only when the link changes; `rows` refreshing must not reopen a sheet the user closed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [target?.open, target?.tab]);
const open = openId === null ? null : (rows.find((r) => r.id === openId) ?? null);
const step = (delta: -1 | 1) => {
  if (!open) return;
  const next = stepTarget(visibleIds, String(open.id), delta);
  if (next) setOpenId(Number(next));
};
```

- Row click: `setOpenId(row.id); setTab("content")`. Remove the `openDetail` special case.
- `DataTable` gets `onVisibleRowsChange={setVisibleIds}`.
- Render `{open && <ItemViewer key={open.id} item={open} scope={scopeLabel(open, projectNames)} tab={tab} onTab={setTab} onClose={() => setOpenId(null)} onStep={step} onSaved={() => void onRefetch()} loadedIn={loadedInFor(open, data.projects)} onSelectProject={(path) => navigate("setup", formatSetupTarget({ lens: path }))} />}`.

Add `loadedInFor(row: SetupRow, projects: ProjectSetup[]): { path: string; name: string }[]` to `setupRows.util.ts`, with a test in `setupRows.util.test.ts`. A global or plugin row is loaded in every project that still exists. A project row is loaded only in its own `project_path` project. The lens click works once Part 4 reads `lens`; until then it opens Setup unchanged, which is harmless.

Remove the `SkillPanel`/`ArtifactPanel` imports.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/screens/Setup
git commit -m "feat(setup): every row opens in the viewer; deep links open an item on a tab (#S3)"
```

### Task 3.10: Grade popover with the trend and Fix N automatically

**Files:**
- Create: `src/lib/autoFixAll.ts` + `src/lib/autoFixAll.test.ts`
- Create: `src/components/GradePopover/{index.ts,GradePopover.tsx,GradePopover.types.ts,GradePopover.constants.ts,GradePopover.css,GradePopover.test.tsx,GradePopover.stories.tsx,useGradePopover.ts}`
- Modify: `src/screens/Setup/Setup.tsx` (pass `badge={<GradePopover grade={grade} />}` to `SummaryLine`)
- Modify: `src/components/VerdictHero/useVerdictHero.ts` (`runAutoFix` calls `autoFixAll`, one implementation until Part 5 deletes VerdictHero)

**Interfaces:**
- Consumes:
  - `commands.getAnalytics(90)` → `Analytics.trend: TrendPoint[]`, `open_issues`. This keeps `get_analytics` alive; see the decisions in the report.
  - `commands.listFiles()`, `getFileDetail`, `applyFix`, `scanNow`
  - `fixableEdits` (3.6), `TrendChart`, `scoreGradeDetail`, `formatTrendDelta`. The last one moves to `src/components/TrendChart/trendChart.util.ts` from `src/screens/Overview/overview.util.ts`, so it outlives Overview. Keep its test with it.
- Produces:
  - `autoFixAll(): Promise<{ files: number; edits: number }>`
  - `GradePopover({ grade: Grade | null })`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/autoFixAll.test.ts
import { describe, expect, it, vi } from "vitest";
const calls: unknown[] = [];
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  commands: {
    listFiles: vi.fn(async () => ({ status: "ok", data: [{ id: "/a", issue_count: 2 }, { id: "/b", issue_count: 0 }] })),
    getFileDetail: vi.fn(async (id: string) => ({ status: "ok", data: { id, issues: [{ fix_from: "npm", fix_to: "pnpm" }, { fix_from: null, fix_to: null }] } })),
    applyFix: vi.fn(async (...args: unknown[]) => { calls.push(args); return { status: "ok", data: { git_ref: null } }; }),
    scanNow: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));
import { autoFixAll } from "./autoFixAll";

describe("autoFixAll", () => {
  it("applies every deterministic fix on files with findings, then scans once", async () => {
    const result = await autoFixAll();
    expect(result).toEqual({ files: 1, edits: 1 });
    expect(calls).toEqual([["/a", [{ from: "npm", to: "pnpm" }], false, "auto"]]);
  });
});
```

```tsx
// src/components/GradePopover/GradePopover.test.tsx
it("opens on click with the trend, the open findings and Fix N automatically", async () => {
  render(<GradePopover grade="C" state={{ trend: [{ t: "1790000000", score: 70 }, { t: "1790086400", score: 74 }], openFindings: 12, fixable: 5, loading: false }} />);
  fireEvent.click(screen.getByRole("button", { name: "Grade C, show health trend" }));
  expect(screen.getByRole("dialog", { name: "Health trend" })).toBeInTheDocument();
  expect(screen.getByText("12 open findings")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Fix 5 issues automatically" })).toBeInTheDocument();
});

it("closes on Escape and hides the fix button when nothing is fixable", () => {
  render(<GradePopover grade="A" state={{ trend: [], openFindings: 0, fixable: 0, loading: false }} />);
  fireEvent.click(screen.getByRole("button", { name: /Grade A/ }));
  expect(screen.queryByRole("button", { name: /automatically/ })).toBeNull();
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/lib/autoFixAll.test.ts src/components/GradePopover`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/lib/autoFixAll.ts
import { commands } from "@/lib/ipc";
import { fixableEdits } from "@/screens/Setup/Findings/findings.util";

/**
 * Every deterministic fix across every graded file with findings, then one
 * scan. The cross-file Auto-fix that lived on Overview (spec §4.2). Files
 * are fixed one at a time: `apply_fix` snapshots each for Undo.
 */
export async function autoFixAll(): Promise<{ files: number; edits: number }> {
  const list = await commands.listFiles();
  if (list.status !== "ok") return { files: 0, edits: 0 };
  let files = 0;
  let edits = 0;
  for (const f of list.data.filter((x) => x.issue_count > 0)) {
    const d = await commands.getFileDetail(f.id);
    if (d.status !== "ok" || !d.data) continue;
    const e = fixableEdits(d.data);
    if (e.length === 0) continue;
    const r = await commands.applyFix(f.id, e, false, "auto");
    if (r.status === "ok") {
      files += 1;
      edits += e.length;
    }
  }
  await commands.scanNow();
  return { files, edits };
}
```

`useGradePopover.ts` loads `getAnalytics(90)` → `{ trend, openFindings: open_issues }`. It computes `fixable` by summing `fixableEdits(detail).length` across files with findings, using the same loop as above without applying anything. It refetches on `scan-done` and exposes `runFix` (calls `autoFixAll`, then refetches). The loop reads every graded file on open; on the owner's machine that is 37 files, which is fine. Only load when the popover opens, never on mount.

`GradePopover.tsx` renders:
- a trigger `<button aria-label={`Grade ${grade}, show health trend`} aria-expanded>` holding the tinted letter;
- when open, a `role="dialog" aria-label="Health trend"` card anchored under it (absolute, `--shadow-pop`), holding:
  - the `TrendChart` (`height={140}`, `valueDetail={scoreGradeDetail}`);
  - `formatTrendDelta(delta, trend[0]?.t)`;
  - `{openFindings} open findings`;
  - `Fix {fixable} issues automatically` (primary, hidden at 0).
- Escape and an outside click close it.
- Render nothing when `grade === null`.
- `state` is a story override that bypasses the hook.

Stories: `Closed`, `Open`, `NothingFixable`, `Loading`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/lib src/components/GradePopover src/components/TrendChart src/screens/Setup src/components/VerdictHero src/screens/Overview`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(setup): the grade badge opens the health trend and Fix N issues automatically (#S3)"
```

### Task 3.11: Sidebar loses Overview, Scans, Analytics; Part 3 gate

**Files:**
- Modify: `src/components/Sidebar/Sidebar.constants.ts`. `NAV_ITEMS` becomes Setup, Projects, Settings. `NAV_OWNER`: `detail`, `overview`, `analytics` and `scans` map to `"setup"`, and `project` maps to `"projects"`.
- Test: `src/components/Sidebar/Sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it("lists exactly Setup, Projects, Settings (spec §3.1)", () => {
  render(<Sidebar active="setup" onNavigate={vi.fn()} />);
  const labels = screen.getAllByRole("button").map((b) => b.textContent);
  expect(labels.slice(0, 3)).toEqual(["Setup", "Projects", "Settings"]);
  for (const gone of ["Overview", "Prompts", "Scans", "Analytics", "Rules"]) expect(labels).not.toContain(gone);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/Sidebar`
Expected: FAIL.

- [ ] **Step 3: Implement** the two constant edits. The routes still render if reached (the panel and old links) until Part 5 removes them.

- [ ] **Step 4: Part 3 gate**

Run: `pnpm check`
Expected: `✔ all gates passed`. In the running app, clicking a finding jumps to its line, the popover's Fix N works, and agents and commands are editable.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar
git commit -m "feat(ui): sidebar is Setup, Projects, Settings (#S3)"
```

---
# Part 4: The project lens replaces project pages (closes #S4)

**What the backend actually knows (read before Part 4):**
- **Load order:** `harness_query::effective_rules` orders a project's *instruction files* as global first, then the project, then `CLAUDE.md`, `AGENTS.md`, then name.
- **Overrides:** there is no override or shadowing data, and no "loaded only in a subfolder" data (§5's examples). The lens therefore numbers instructions in that order and mutes nothing. It makes no override claims, as §5 itself requires ("where the backend knows").
- **Per-project usage:** `project_usage(...).ranked` gives `uses`, `sessions`, `error_rate` and `avg_turn_tokens` per `artifact_id`, but no last-used time. Task 4.1 adds it.
- **Plugins:** the backend does not model "enabled" plugins; the inventory lists installed ones. The lens includes every installed plugin's items, the same set Setup shows today.

### Task 4.1: Backend: last use per ranked target

**Files:**
- Modify: `src-tauri/src/harness_query.rs`: `RankedTarget` (≈line 104), `ranked_targets` (≈line 450: the `COLUMNS` const, the `read` closure, and the push)
- Regenerate: `src/lib/bindings.ts`

**Interfaces:**
- Produces: `RankedTarget.last_used: Option<String>` (the latest `invocations.ts` in the group, RFC3339). TS: `last_used: string | null`.

- [ ] **Step 1: Write the failing test** (harness_query tests)

```rust
#[test]
fn project_usage_reports_when_each_target_was_last_used() {
    let (conn, home) = seeded();
    let app = home.root.join("work/app").to_string_lossy().into_owned();
    // 2026-08-02T00:00:00Z, the fixture's "now" (see `seeded`).
    let u = project_usage(&conn, "claude_code", &app, 1_785_628_800, 30).unwrap();
    let expected: Option<String> = conn
        .query_row(
            "SELECT max(ts) FROM invocations WHERE harness = 'claude_code' AND project_path = rtrim(?1, '/')
               AND kind = ?2 AND target = ?3",
            rusqlite::params![app, u.ranked[0].kind.as_str(), u.ranked[0].target],
            |r| r.get(0),
        )
        .unwrap();
    assert!(u.ranked[0].last_used.is_some());
    assert_eq!(u.ranked[0].last_used, expected);
}
```

`InvocationKind::as_str` exists in `crate::harness::model`; confirm the name before use. If `u.ranked` is empty for the fixture project, pick the project the fixture's session belongs to. `setup_view_joins_grades_and_usage` shows `adapt` is used once.

- [ ] **Step 2: Run it and watch it fail**

Run: `cd src-tauri && cargo test --lib harness_query::tests::project_usage_reports`
Expected: compile error (no field).

- [ ] **Step 3: Implement.** In `ranked_targets`:
  - append `, max(ts)` to the `COLUMNS` select list;
  - read it as `r.get::<_, Option<String>>(7)?` in the `read` closure, extending the tuple;
  - set `last_used` in the push.

  Add `pub last_used: Option<String>` to `RankedTarget` with a doc comment. Regenerate the bindings. Then fix the TS fixtures that build `RankedTarget` literals: `grep -rln "avg_turn_tokens" src | xargs grep -l "artifact_id"`. Add `last_used: null` to each.

- [ ] **Step 4: Run and pass**

Run: `cd src-tauri && cargo test --lib && cargo clippy --all-targets -- -D warnings && cargo test --lib ipc::tests::export_typescript_bindings && cd .. && pnpm tsc --noEmit -p tsconfig.json`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src-tauri src
git commit -m "feat(engine): ranked usage says when each target was last used (#S4)"
```

### Task 4.2: Lens rows

**Files:**
- Create: `src/screens/Setup/lens.util.ts`
- Test: `src/screens/Setup/lens.util.test.ts`

**Interfaces:**
- Consumes: `SetupRow` (2.2), `EffectiveRule`, `ProjectUsage`, `RankedTarget` (with `last_used`, 4.1), `KIND_ORDER` (`Setup.constants.ts`).
- Produces:
  - `lensRows(rows: SetupRow[], projectPath: string, effective: EffectiveRule[] | null, usage: ProjectUsage | null): SetupRow[]`. It returns the items that apply in the project, ordered: instructions by load order, then unordered instructions by name, then the other kinds in `KIND_ORDER` by name. `load_order` is set and usage is project-scoped.

- [ ] **Step 1: Write the failing test**

```ts
// src/screens/Setup/lens.util.test.ts
import { describe, expect, it } from "vitest";
import type { EffectiveRule, ProjectUsage } from "@/lib/ipc";
import type { SetupRow } from "./setupRows.util";
import { lensRows } from "./lens.util";

const row = (over: Partial<SetupRow>): SetupRow => ({
  id: 1, harness: "claude_code", layer: "global", kind: "skill", name: "x", path: "/x", plugin_name: null,
  description: null, bytes: 0, grade: null, score: null, file_id: null, usage: null, issue_count: null,
  worst_severity: null, origin: "inventory", project_label: null, project_path: null, load_order: null, ...over,
});
const WEB = "/code/web";

const rows = [
  row({ id: 1, kind: "rule", name: "CLAUDE.md", path: "/h/.claude/CLAUDE.md" }),
  row({ id: 2, kind: "rule", layer: "project", name: "CLAUDE.md", path: `${WEB}/CLAUDE.md`, project_path: WEB }),
  row({ id: 3, kind: "rule", layer: "project", name: "CLAUDE.md", path: "/code/api/CLAUDE.md", project_path: "/code/api" }),
  row({ id: 4, kind: "skill", name: "adapt", usage: { total: 99, sessions: 9, last_used: null, error_rate: 0, avg_turn_tokens: 1, count_30d: 0, count_prev_30d: 0 } }),
  row({ id: 5, kind: "agent", layer: "project", name: "reviewer", path: `${WEB}/.claude/agents/r.md`, project_path: WEB }),
  row({ id: -7, kind: "rule", layer: "project", origin: "graded", name: "AGENTS.md", path: `${WEB}/AGENTS.md`, project_path: WEB, file_id: `${WEB}/AGENTS.md` }),
  row({ id: 6, kind: "skill", layer: "plugin", name: "design", plugin_name: "superpowers" }),
];
const effective: EffectiveRule[] = [
  { layer: "global", path: "/h/.claude/CLAUDE.md", name: "CLAUDE.md", grade: "B", file_id: null },
  { layer: "project", path: `${WEB}/CLAUDE.md`, name: "CLAUDE.md", grade: "C", file_id: null },
];
const usage = {
  sessions_per_day: [],
  ranked: [{ kind: "skill", target: "adapt", artifact_id: 4, uses: 3, sessions: 2, error_rate: 0.5, avg_turn_tokens: 800, last_used: "2026-09-26T10:00:00Z" }],
} as unknown as ProjectUsage;

describe("lensRows", () => {
  it("keeps global, plugin and this project's items, and drops other projects'", () => {
    const ids = lensRows(rows, WEB, effective, usage).map((r) => r.id);
    expect(ids).not.toContain(3);
    expect(ids).toEqual(expect.arrayContaining([1, 2, 4, 5, -7, 6]));
  });

  it("numbers instructions in load order and lists them first", () => {
    const out = lensRows(rows, WEB, effective, usage);
    expect(out.slice(0, 3).map((r) => [r.id, r.load_order])).toEqual([[1, 1], [2, 2], [-7, null]]);
  });

  it("groups the other kinds after instructions, in kind order then name", () => {
    const rest = lensRows(rows, WEB, effective, usage).slice(3).map((r) => r.id);
    expect(rest).toEqual([4, 6, 5]); // skills (adapt, design) before agents
  });

  it("swaps in this project's usage, and none where the item was not used here", () => {
    const out = lensRows(rows, WEB, effective, usage);
    expect(out.find((r) => r.id === 4)?.usage).toMatchObject({ total: 3, sessions: 2, error_rate: 0.5, avg_turn_tokens: 800, last_used: "2026-09-26T10:00:00Z" });
    expect(out.find((r) => r.id === 5)?.usage).toBeNull();
  });

  it("still lists everything, unnumbered, for a project no harness has worked in", () => {
    const out = lensRows(rows, WEB, null, null);
    expect(out.every((r) => r.load_order === null)).toBe(true);
    expect(out.find((r) => r.id === 4)?.usage).toBeNull();
  });

  it("matches a project path with or without a trailing slash", () => {
    expect(lensRows(rows, `${WEB}/`, effective, usage).map((r) => r.id)).toContain(5);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/screens/Setup/lens.util.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/screens/Setup/lens.util.ts
import type { EffectiveRule, ProjectUsage, UsageStat } from "@/lib/ipc";
import { KIND_ORDER } from "./Setup.constants";
import type { SetupRow } from "./setupRows.util";
import { USAGE_KINDS } from "./setup.unified";

const trim = (p: string) => p.replace(/\/+$/, "");

/**
 * Setup "as Claude Code sees <project>" (spec §5): what applies there, instructions
 * first in the harness's load order, then every other kind; usage counted from
 * that project's sessions only. The backend knows no overrides, so nothing is
 * muted — the lens only claims what `effective_rules` actually computes.
 */
export function lensRows(
  rows: SetupRow[],
  projectPath: string,
  effective: EffectiveRule[] | null,
  usage: ProjectUsage | null,
): SetupRow[] {
  const here = trim(projectPath);
  const applies = rows.filter((r) => r.layer !== "project" || (r.project_path !== null && trim(r.project_path) === here));
  const order = new Map((effective ?? []).map((e, i) => [e.path, i + 1]));
  const ranked = new Map((usage?.ranked ?? []).filter((t) => t.artifact_id !== null).map((t) => [t.artifact_id as number, t]));

  const scoped = applies.map((r): SetupRow => {
    const load_order = r.kind === "rule" ? (order.get(r.path) ?? null) : null;
    if (!USAGE_KINDS.has(r.kind)) return { ...r, load_order };
    const t = ranked.get(r.id);
    const stat: UsageStat | null = t
      ? { total: t.uses, sessions: t.sessions, last_used: t.last_used, error_rate: t.error_rate,
          avg_turn_tokens: t.avg_turn_tokens, count_30d: 0, count_prev_30d: 0 }
      : null;
    return { ...r, load_order, usage: stat };
  });

  const kindRank = (k: SetupRow["kind"]) => KIND_ORDER.indexOf(k);
  return scoped.sort((a, b) => {
    const ar = a.kind === "rule", br = b.kind === "rule";
    if (ar !== br) return ar ? -1 : 1;
    if (ar && br) {
      if (a.load_order !== null && b.load_order !== null) return a.load_order - b.load_order;
      if (a.load_order !== null) return -1;
      if (b.load_order !== null) return 1;
    }
    return kindRank(a.kind) - kindRank(b.kind) || a.name.localeCompare(b.name);
  });
}
```

`RankedTarget.error_rate` is typed `number | null` in the bindings while Rust fills `0.0` for none. Keep the pass-through as it is; `UsageStat.error_rate` is `number | null` too.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup/lens.util.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Setup/lens.util.ts src/screens/Setup/lens.util.test.ts
git commit -m "feat(setup): lens rows — what applies in a project, instructions in load order, that project's usage (#S4)"
```

### Task 4.3: useLens and the ProjectStrip

**Files:**
- Create: `src/screens/Setup/useLens.ts` + `useLens.test.ts`
- Create: `src/screens/Setup/ProjectStrip/{index.ts,ProjectStrip.tsx,ProjectStrip.types.ts,ProjectStrip.constants.ts,ProjectStrip.css,ProjectStrip.test.tsx,ProjectStrip.stories.tsx}`
- Move: `src/screens/Project/StatePanel/MissingFolderBanner.tsx` and its constants (`MISSING_FOLDER_TITLE`/`…BODY` from `Project.constants.ts`) → `src/screens/Setup/ProjectStrip/`. `Project.tsx` imports them from there until Part 5.

**Interfaces:**
- Consumes: `commands.getEffectiveRules(harness, projectPath)`, `commands.getProjectUsage(harness, projectPath, windowDays)`, `commands.revealProject(projectPath)` (3.3), `Sparkline` (`data: number[]`), `relativeSession` (`setup.util.ts`).
- Produces:
  - `LENS_WINDOW_DAYS = 90`
  - `useLens(project: ProjectSetup | null): { effective: EffectiveRule[] | null; usage: ProjectUsage | null; loading: boolean; failed: boolean }`. With no harness it returns nulls and never calls.
  - `ProjectStrip({ project: ProjectSetup; sessionsPerDay: DayCount[] | null; onReveal: () => void })`

- [ ] **Step 1: Write the failing tests**

```ts
// src/screens/Setup/useLens.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
const getEffectiveRules = vi.fn(async () => ({ status: "ok", data: [] }));
const getProjectUsage = vi.fn(async () => ({ status: "ok", data: { ranked: [], sessions_per_day: [] } }));
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getEffectiveRules, getProjectUsage },
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
import { useLens } from "./useLens";

const project = { harness: "claude_code", path: "/code/web", name: "web", exists: true, session_count: 1, last_session_at: null, artifacts: [] };

describe("useLens", () => {
  it("loads the load order and the project's usage over 90 days", async () => {
    const { result } = renderHook(() => useLens(project));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getEffectiveRules).toHaveBeenCalledWith("claude_code", "/code/web");
    expect(getProjectUsage).toHaveBeenCalledWith("claude_code", "/code/web", 90);
    expect(result.current.usage).toEqual({ ranked: [], sessions_per_day: [] });
  });

  it("asks nothing with no lens", () => {
    getEffectiveRules.mockClear();
    const { result } = renderHook(() => useLens(null));
    expect(result.current).toMatchObject({ effective: null, usage: null, loading: false });
    expect(getEffectiveRules).not.toHaveBeenCalled();
  });
});
```

```tsx
// src/screens/Setup/ProjectStrip/ProjectStrip.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProjectStrip } from "./ProjectStrip";

const project = { harness: "claude_code", path: "/code/web", name: "web", exists: true, session_count: 148,
  last_session_at: "2026-09-26T10:00:00Z", artifacts: [] };

describe("ProjectStrip", () => {
  it("names the project, its sessions and offers Reveal in Finder", () => {
    const onReveal = vi.fn();
    render(<ProjectStrip project={project} sessionsPerDay={[{ day: "2026-09-25", count: 2 }, { day: "2026-09-26", count: 5 }]} onReveal={onReveal} />);
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("7 sessions · 90 days")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    expect(onReveal).toHaveBeenCalled();
  });

  it("says the folder is missing instead of drawing a chart", () => {
    render(<ProjectStrip project={{ ...project, exists: false }} sessionsPerDay={null} onReveal={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/folder/i);
    expect(screen.queryByRole("button", { name: "Reveal in Finder" })).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Setup/useLens.test.ts src/screens/Setup/ProjectStrip`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/screens/Setup/useLens.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type EffectiveRule, type ProjectSetup, type ProjectUsage } from "@/lib/ipc";

/** The window the lens counts usage over (was the project page's). */
export const LENS_WINDOW_DAYS = 90;

/**
 * What the lens needs beyond the inventory: the harness's load order for the
 * project, and its usage. A project no harness has worked in has neither —
 * that is a normal state, not an error.
 */
export function useLens(project: ProjectSetup | null) {
  const [effective, setEffective] = useState<EffectiveRule[] | null>(null);
  const [usage, setUsage] = useState<ProjectUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const harness = project?.harness ?? null;
  const path = project?.path ?? null;

  const load = useCallback(async () => {
    const mine = ++generation.current;
    setEffective(null);
    setUsage(null);
    setFailed(false);
    if (!isTauri || !harness || !path) return setLoading(false);
    setLoading(true);
    const [rules, used] = await Promise.all([
      commands.getEffectiveRules(harness, path),
      commands.getProjectUsage(harness, path, LENS_WINDOW_DAYS),
    ]);
    if (generation.current !== mine) return;
    setEffective(rules.status === "ok" ? rules.data : null);
    setUsage(used.status === "ok" ? used.data : null);
    setFailed(rules.status !== "ok" || used.status !== "ok");
    setLoading(false);
  }, [harness, path]);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    if (!isTauri) return;
    const off = listen("scan-done", () => void load());
    return () => void off.then((fn) => fn());
  }, [load]);

  return { effective, usage, loading, failed };
}
```

`ProjectStrip.tsx` is a flex row inside a `var(--group)` background with a 10px radius:
- the project name, bold;
- `{sum} sessions · 90 days` (sum of `sessionsPerDay` counts);
- `<Sparkline data={sessionsPerDay.map((d) => d.count)} width={160} height={22} />`;
- `last session {relativeSession(project.last_session_at)}`;
- a `Button size="sm"` labelled "Reveal in Finder".

When `project.exists === false`, render the moved `MissingFolderBanner` in place of the chart and the button. The banner already has `role="status"`. Stories: `Active`, `NoSessions`, `MissingFolder`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup src/screens/Project`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/screens/Setup src/screens/Project
git commit -m "feat(setup): useLens and the project strip (#S4)"
```

### Task 4.4: ViewingSwitcher

**Files:**
- Create: `src/components/ViewingSwitcher/{index.ts,ViewingSwitcher.tsx,ViewingSwitcher.types.ts,ViewingSwitcher.constants.ts,ViewingSwitcher.test.tsx,ViewingSwitcher.stories.tsx}`

**Interfaces:**
- Consumes: `FilterSelect` (`label`, `options: {id,label,count}[]`, `selected: string[]`, `multi: false`, `onToggle`, `onClear`). It becomes searchable past `SEARCH_THRESHOLD`.
- Produces: `ViewingSwitcher({ projects: { path: string; name: string; lastSessionAt: string | null }[]; lens: string | null; onChange: (lens: string | null) => void })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ViewingSwitcher/ViewingSwitcher.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ViewingSwitcher } from "./ViewingSwitcher";

const projects = [
  { path: "/code/api", name: "api", lastSessionAt: "2026-09-20T00:00:00Z" },
  { path: "/code/web", name: "web", lastSessionAt: "2026-09-26T00:00:00Z" },
];

describe("ViewingSwitcher", () => {
  it("reads All setup with no lens", () => {
    render(<ViewingSwitcher projects={projects} lens={null} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Viewing: All setup/ })).toBeInTheDocument();
  });

  it("names the lensed project", () => {
    render(<ViewingSwitcher projects={projects} lens="/code/web" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /as Claude Code sees web/ })).toBeInTheDocument();
  });

  it("lists projects most recently active first and reports a pick", () => {
    const onChange = vi.fn();
    render(<ViewingSwitcher projects={projects} lens={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Viewing/ }));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toMatch(/All setup/);
    expect(options[1]).toMatch(/web/);
    fireEvent.click(screen.getByRole("option", { name: /web/ }));
    expect(onChange).toHaveBeenCalledWith("/code/web");
  });

  it("clears back to All setup", () => {
    const onChange = vi.fn();
    render(<ViewingSwitcher projects={projects} lens="/code/web" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /as Claude Code sees web/ }));
    fireEvent.click(screen.getByRole("option", { name: /All setup/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

Before relying on these role queries, read `FilterSelect.tsx` to learn how its trigger names itself and what role its options have. If FilterSelect cannot label its trigger with the selected value, pass `label={currentLabel}` and adjust the queries to what it renders. The behaviour stays the same.

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm vitest run src/components/ViewingSwitcher`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// ViewingSwitcher.constants.ts
export const ALL_SETUP = "All setup";
export const ALL_ID = "__all__";
export const sees = (name: string) => `as Claude Code sees ${name}`;
```

```tsx
// ViewingSwitcher.tsx
import { useMemo } from "react";
import { FilterSelect } from "@/components/FilterSelect";
import { ALL_ID, ALL_SETUP, sees } from "./ViewingSwitcher.constants";
import type { ViewingSwitcherProps } from "./ViewingSwitcher.types";

/** Setup's lens control: the whole setup, or what Claude Code loads in one project (spec §4.1). */
export function ViewingSwitcher({ projects, lens, onChange }: ViewingSwitcherProps) {
  const ordered = useMemo(
    () => [...projects].sort((a, b) => (b.lastSessionAt ?? "").localeCompare(a.lastSessionAt ?? "") || a.name.localeCompare(b.name)),
    [projects],
  );
  const current = ordered.find((p) => p.path === lens);
  return (
    <FilterSelect
      label={`Viewing: ${current ? sees(current.name) : ALL_SETUP}`}
      multi={false}
      selected={[lens ?? ALL_ID]}
      options={[{ id: ALL_ID, label: ALL_SETUP, count: 0 }, ...ordered.map((p) => ({ id: p.path, label: p.name, count: 0 }))]}
      onToggle={(id) => onChange(id === ALL_ID ? null : id)}
      onClear={() => onChange(null)}
    />
  );
}
```

If FilterSelect renders `count` as a badge, a `0` badge on every option is noise. Add an optional `showCounts?: boolean` (default `true`) to `FilterSelectProps`, pass `false` here, and add a FilterSelect test that counts are hidden when it is false. Stories: `AllSetup`, `Lensed`, `ManyProjects` (searchable).

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/components/ViewingSwitcher src/components/FilterSelect`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ViewingSwitcher src/components/FilterSelect
git commit -m "feat(ui): ViewingSwitcher — All setup, or as Claude Code sees a project (#S4)"
```

### Task 4.5: Setup gains the lens

**Files:**
- Modify: `src/screens/Setup/Setup.tsx` (header: `ViewingSwitcher`; lens state from `target.lens`; `ProjectStrip`; `lensRows`; Scope filter hidden under the lens; `defaultSort` none and `stateKey` `"setup.lens"` under the lens)
- Modify: `src/screens/Setup/Setup.test.tsx`, `Setup.stories.tsx`, `Setup.constants.ts` (`LENS_TABLE_STATE_KEY = "setup.lens"`)

**Interfaces:**
- Consumes: `ViewingSwitcher` (4.4), `useLens`, `ProjectStrip` (4.3), `lensRows` (4.2), `visibleColumnIds(kind, rows, lens: true)` (2.4), `formatSetupTarget` (2.7).

- [ ] **Step 1: Write the failing tests**

```tsx
it("shows only what loads in the lensed project, instructions numbered first", async () => {
  // useLens mocked: effective = [global CLAUDE.md, project CLAUDE.md], usage with one ranked skill
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: APP_PATH }} />);
  expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
  const first = screen.getAllByRole("row")[1];
  expect(first).toHaveTextContent("1");
  expect(screen.queryByText(OTHER_PROJECT_ONLY_ITEM)).toBeNull();
});

it("hides the Scope filter under the lens and shows the project strip", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: APP_PATH }} />);
  expect(screen.queryByRole("button", { name: /Scope/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeInTheDocument();
});

it("switches lens from the Viewing control", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
  fireEvent.click(screen.getByRole("button", { name: /Viewing/ }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(APP_NAME) }));
  expect(screen.getByRole("button", { name: /as Claude Code sees/ })).toBeInTheDocument();
});

it("shows the missing-folder message and an empty table for a project that is gone", () => {
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: MISSING_PROJECT_PATH }} />);
  expect(screen.getByRole("status")).toHaveTextContent(/folder/i);
});
```

Take `APP_PATH`, `APP_NAME`, `MISSING_PROJECT_PATH` and `OTHER_PROJECT_ONLY_ITEM` from the existing Setup fixture, which already has one existing and one missing project. If an item name exists in only one project, use it. Otherwise add one to the fixture.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Setup/Setup.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `Inventory`:

```tsx
const [lens, setLens] = useState<string | null>(target?.lens ?? null);
useEffect(() => { if (target?.lens !== undefined) setLens(target.lens ?? null); }, [target?.lens]);
const lensProject = useMemo(() => (lens ? (data.projects.find((p) => p.path === lens) ?? null) : null), [lens, data]);
const lensData = useLens(lensProject);
const base = useMemo(() => setupRows(data, files), [data, files]);
const rows = useMemo(
  () => (lens ? (lensProject?.exists === false ? [] : lensRows(base, lens, lensData.effective, lensData.usage)) : base),
  [base, lens, lensProject, lensData.effective, lensData.usage],
);
```

Everything downstream (kind counts, filters, columns) already reads `rows`, so it adapts. Pass `visibleColumnIds(kind, …, lens !== null)`. Under the lens:
- `pills={[]}` (no Scope);
- `defaultSort` undefined;
- `stateKey={LENS_TABLE_STATE_KEY}`.

The header (in `Setup`, not `Inventory`; lift `lens` up if needed) renders the title, then `<ViewingSwitcher projects={data.projects.map((p) => ({ path: p.path, name: p.name, lastSessionAt: p.last_session_at }))} lens={lens} onChange={setLens} />`. Below it, the lens renders `<ProjectStrip project={lensProject} sessionsPerDay={lensData.usage?.sessions_per_day ?? null} onReveal={() => void commands.revealProject(lensProject.path)} />`. A graded-only project path (not in `data.projects`) can still be the lens: `lensProject` is null, so there is no strip; `lensRows` still filters by `project_path`.

The viewer's `onSelectProject` (Task 3.9) now calls `setLens(path)` directly instead of `navigate`. The viewer's header usage already reads `item.usage`, which is project-scoped under the lens.

Stories: `Lensed`, `LensedMissingFolder`, `LensedNoHarness`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Setup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/screens/Setup
git commit -m "feat(setup): the project lens — only what loads there, in load order, with its own usage (#S4)"
```

### Task 4.6: Projects list and Recent open the lens; Part 4 gate

**Files:**
- Modify:
  - `src/screens/Projects/projects.columns.tsx`: headers "Instructions" (was "Rule files"), "Findings" (was "Open issues"), "Erroring" (was "Errors"); add an `items` column; `DEFAULT_SORT = { id: "lastSession", desc: true }`
  - `src/screens/Projects/Projects.tsx`: row click → `navigate("setup", formatSetupTarget({ lens: row.id }))`; load `getSetup` for the items count
  - `src/screens/Projects/useProjects.ts`
- Create: `src/screens/Projects/projects.util.ts` + `projects.util.test.ts`
- Modify: `src/components/Sidebar/Sidebar.tsx` (a recent opens `("setup", formatSetupTarget({ lens: project.id }))`)
- Test: `Projects.test.tsx`, `projects.columns.test.tsx`, `Sidebar.test.tsx`, `App.test.tsx`

**Interfaces:**
- Produces: `itemsAvailable(projectPath: string, setup: SetupView | null): number | null` = global + plugin items + that project's items; `null` before the setup loads.

- [ ] **Step 1: Write the failing tests**

```ts
// src/screens/Projects/projects.util.test.ts
import { describe, expect, it } from "vitest";
import type { SetupView } from "@/lib/ipc";
import { itemsAvailable } from "./projects.util";

const setup = { harnesses: [], global: [{}, {}, {}], projects: [{ path: "/code/web", artifacts: [{}, {}] }, { path: "/code/api", artifacts: [{}] }] } as unknown as SetupView;

describe("itemsAvailable", () => {
  it("counts everything global plus the project's own items", () => {
    expect(itemsAvailable("/code/web", setup)).toBe(5);
    expect(itemsAvailable("/code/web/", setup)).toBe(5);
  });
  it("counts only the global items for a project the inventory does not know", () => {
    expect(itemsAvailable("/code/other", setup)).toBe(3);
  });
  it("says nothing before the setup loads", () => {
    expect(itemsAvailable("/code/web", null)).toBeNull();
  });
});
```

```tsx
// Projects.test.tsx (add)
it("opens Setup with the project's lens and sorts by last session", () => {
  const navigate = vi.fn();
  render(<Projects navigate={navigate} rows={fixtureRows} />);
  fireEvent.click(screen.getAllByRole("row")[1]);
  expect(navigate).toHaveBeenCalledWith("setup", expect.stringContaining("lens="));
});
```

```tsx
// Sidebar.test.tsx (add; recents need `projects`, so render with the hook mocked to one project)
it("opens a recent project as a lens on Setup", () => {
  const onNavigate = vi.fn();
  render(<Sidebar active="setup" onNavigate={onNavigate} />);
  fireEvent.click(screen.getByRole("button", { name: /web/ }));
  expect(onNavigate).toHaveBeenCalledWith("setup", "lens=%2Fcode%2Fweb");
});
```

If `Projects` has no `rows` override prop, add one for tests and stories, mirroring `Setup`'s `data`. For the Sidebar test, mock `./useSidebar` to return `{ projects: [{ id: "/code/web", name: "web", grade: "B", logo: null }], counts: {} }`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Projects src/components/Sidebar`
Expected: FAIL.

- [ ] **Step 3: Implement.**

```ts
// src/screens/Projects/projects.util.ts
import type { SetupView } from "@/lib/ipc";

/** Items Claude Code can use in the project: the global and plugin layers plus the project's own. */
export function itemsAvailable(projectPath: string, setup: SetupView | null): number | null {
  if (!setup) return null;
  const here = projectPath.replace(/\/+$/, "");
  const own = setup.projects.find((p) => p.path.replace(/\/+$/, "") === here)?.artifacts.length ?? 0;
  return setup.global.length + own;
}
```

Add the `items` column (`countColumn("items", "Items", (r) => itemsAvailable(r.id, setup) ?? 0)`). Pass `setup` through a `ProjectsColumnsCtx` object, cached like Setup's `columnsFor`, rather than as a module global. Load `setup` in `useProjects` with `commands.getSetup()` in the same `Promise.all`. Everything else is listed under **Files**. `App.tsx` needs no change: the `project` route still exists until Part 5, but nothing in the app sends it any more (grep `navigate("project"` to confirm; the only hits should be in `Project` itself and tests).

- [ ] **Step 4: Part 4 gate**

Run: `pnpm check`
Expected: `✔ all gates passed`. In the running app, a Recent entry or a Projects row opens Setup lensed; the web-app lens lists only its items in load order, with its own usage.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(projects): Projects and Recent open the Setup lens; newest activity first (#S4)"
```

---
# Part 5: Navigation state and history, re-point, remove (closes #S5)

### Task 5.1: Navigation state, back stack, legacy resolution

**Files:**
- Create: `src/App/navigation/navigation.types.ts`, `navigation.ts`, `navigation.test.ts`, `legacy.ts`, `legacy.test.ts`, `index.ts`

**Interfaces:**
- Consumes: `SetupTarget`, `parseSetupTarget`, `formatSetupTarget` (2.7); `SettingsTabId`, `resolveSettingsTab` (1.3).
- Produces:
  - `type NavState = { route: "setup"; target: SetupTarget } | { route: "projects" } | { route: "settings"; tab: SettingsTabId }`
  - `interface NavHistory { entries: NavState[]; index: number }`
  - `type NavAction = { type: "push"; state: NavState } | { type: "replace"; state: NavState } | { type: "back" } | { type: "closeItem" }`
  - `initialHistory(state?: NavState): NavHistory`
  - `navReducer(h: NavHistory, a: NavAction): NavHistory`
  - `current(h): NavState`
  - `canGoBack(h): boolean`
  - `resolveExternal(route: string, target: string | null | undefined): NavState`

- [ ] **Step 1: Write the failing tests**

```ts
// src/App/navigation/legacy.test.ts
import { describe, expect, it } from "vitest";
import { resolveExternal } from "./legacy";

describe("resolveExternal", () => {
  it.each([
    ["overview", null, { route: "setup", target: {} }],
    ["prompts", null, { route: "setup", target: { kind: "rule" } }],
    ["scans", null, { route: "setup", target: {} }],
    ["analytics", null, { route: "setup", target: {} }],
    ["detail", "/code/web/CLAUDE.md", { route: "setup", target: { open: { fileId: "/code/web/CLAUDE.md" }, tab: "findings" } }],
    ["project", "/code/web", { route: "setup", target: { lens: "/code/web" } }],
    ["rules", "custom", { route: "settings", tab: "checks" }],
    ["rules-new", null, { route: "settings", tab: "checks" }],
    ["settings", "app", { route: "settings", tab: "about" }],
    ["projects", null, { route: "projects" }],
    ["setup", "mcp_server", { route: "setup", target: { kind: "mcp_server" } }],
    ["setup", "kind=skill&filter=never", { route: "setup", target: { kind: "skill", filter: "never" } }],
  ])("lands %s (%s) somewhere useful", (route, target, expected) => {
    expect(resolveExternal(route, target)).toEqual(expected);
  });

  it("never blanks the window on a route it does not know", () => {
    expect(resolveExternal("nonsense", "x")).toEqual({ route: "setup", target: {} });
  });

  it("treats an untargeted detail as plain Setup", () => {
    expect(resolveExternal("detail", null)).toEqual({ route: "setup", target: {} });
  });
});
```

```ts
// src/App/navigation/navigation.test.ts
import { describe, expect, it } from "vitest";
import { canGoBack, current, initialHistory, navReducer } from "./navigation";
import type { NavState } from "./navigation.types";

const setup = (target = {}): NavState => ({ route: "setup", target });

describe("navReducer", () => {
  it("starts on Setup with nothing to go back to", () => {
    const h = initialHistory();
    expect(current(h)).toEqual(setup());
    expect(canGoBack(h)).toBe(false);
  });

  it("pushes and goes back, restoring lens, filter and open item", () => {
    let h = initialHistory(setup({ lens: "/w", filter: "never" }));
    h = navReducer(h, { type: "push", state: setup({ lens: "/w", filter: "never", open: { artifactId: 4 } }) });
    h = navReducer(h, { type: "push", state: { route: "projects" } });
    h = navReducer(h, { type: "back" });
    expect(current(h)).toEqual(setup({ lens: "/w", filter: "never", open: { artifactId: 4 } }));
    h = navReducer(h, { type: "back" });
    expect(current(h)).toEqual(setup({ lens: "/w", filter: "never" }));
  });

  it("drops the forward entries when pushing after going back", () => {
    let h = initialHistory();
    h = navReducer(h, { type: "push", state: { route: "projects" } });
    h = navReducer(h, { type: "back" });
    h = navReducer(h, { type: "push", state: { route: "settings", tab: "ai" } });
    expect(h.entries).toHaveLength(2);
  });

  it("does not stack an entry identical to the current one", () => {
    const h = navReducer(initialHistory(), { type: "push", state: setup() });
    expect(h.entries).toHaveLength(1);
  });

  it("replaces without growing the stack", () => {
    const h = navReducer(initialHistory(setup({ open: { artifactId: 1 }, tab: "content" })), {
      type: "replace", state: setup({ open: { artifactId: 1 }, tab: "usage" }),
    });
    expect(h.entries).toHaveLength(1);
    expect(current(h)).toEqual(setup({ open: { artifactId: 1 }, tab: "usage" }));
  });

  it("closing the viewer pops the entry that opened it", () => {
    let h = initialHistory(setup({ kind: "skill" }));
    h = navReducer(h, { type: "push", state: setup({ kind: "skill", open: { artifactId: 2 } }) });
    h = navReducer(h, { type: "closeItem" });
    expect(h.entries).toHaveLength(1);
    expect(current(h)).toEqual(setup({ kind: "skill" }));
  });

  it("closing a viewer opened by a deep link replaces instead of popping somewhere else", () => {
    let h = initialHistory({ route: "projects" });
    h = navReducer(h, { type: "push", state: setup({ open: { fileId: "/f" }, tab: "findings" }) });
    h = navReducer(h, { type: "closeItem" });
    expect(current(h)).toEqual(setup({}));
    expect(h.entries).toHaveLength(2);
  });

  it("going back at the start does nothing", () => {
    const h = initialHistory();
    expect(navReducer(h, { type: "back" })).toBe(h);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/App/navigation`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// src/App/navigation/navigation.types.ts
import type { SetupTarget } from "../setupTarget";
import type { SettingsTabId } from "@/screens/Settings/Settings.constants";

/** Where the main window is — one serialisable value (spec §10). */
export type NavState =
  | { route: "setup"; target: SetupTarget }
  | { route: "projects" }
  | { route: "settings"; tab: SettingsTabId };

export interface NavHistory {
  entries: NavState[];
  index: number;
}

export type NavAction =
  | { type: "push"; state: NavState }
  | { type: "replace"; state: NavState }
  | { type: "back" }
  | { type: "closeItem" };
```

```ts
// src/App/navigation/navigation.ts
import type { NavAction, NavHistory, NavState } from "./navigation.types";

const same = (a: NavState, b: NavState) => JSON.stringify(a) === JSON.stringify(b);

export const initialHistory = (state: NavState = { route: "setup", target: {} }): NavHistory => ({
  entries: [state],
  index: 0,
});
export const current = (h: NavHistory): NavState => h.entries[h.index];
export const canGoBack = (h: NavHistory): boolean => h.index > 0;

/** The setup state with the open item (and its tab) removed. */
function withoutItem(s: NavState): NavState {
  if (s.route !== "setup") return s;
  const { open: _open, tab: _tab, ...rest } = s.target;
  return { route: "setup", target: rest };
}

export function navReducer(h: NavHistory, a: NavAction): NavHistory {
  switch (a.type) {
    case "push": {
      if (same(current(h), a.state)) return h;
      const entries = [...h.entries.slice(0, h.index + 1), a.state];
      return { entries, index: entries.length - 1 };
    }
    case "replace": {
      const entries = [...h.entries];
      entries[h.index] = a.state;
      return { entries, index: h.index };
    }
    case "back":
      return h.index > 0 ? { entries: h.entries, index: h.index - 1 } : h;
    case "closeItem": {
      const closed = withoutItem(current(h));
      // Opening the item pushed an entry; closing it is Back — unless the
      // item arrived by deep link, where Back would leave Setup altogether.
      if (h.index > 0 && same(h.entries[h.index - 1], closed)) return { entries: h.entries, index: h.index - 1 };
      return navReducer(h, { type: "replace", state: closed });
    }
  }
}
```

```ts
// src/App/navigation/legacy.ts
import { resolveSettingsTab } from "@/screens/Settings/settingsTab.util";
import { parseSetupTarget } from "../setupTarget";
import type { NavState } from "./navigation.types";

const SETUP: NavState = { route: "setup", target: {} };

/**
 * A (route, target) pair from outside the window, or from a link written
 * before navigation state existed, resolved to a place that exists. The
 * panel's `navigate` event, old notifications and in-app `navigate(route,
 * target)` calls all come through here, so no route can blank the shell.
 */
export function resolveExternal(route: string, target: string | null | undefined): NavState {
  const t = target ?? undefined;
  switch (route) {
    case "setup":
      return { route: "setup", target: parseSetupTarget(t) };
    case "projects":
      return { route: "projects" };
    case "settings":
      return { route: "settings", tab: resolveSettingsTab(t) };
    case "rules":
    case "rules-new":
      return { route: "settings", tab: "checks" };
    case "prompts":
      return { route: "setup", target: { kind: "rule" } };
    case "detail":
      return t ? { route: "setup", target: { open: { fileId: t }, tab: "findings" } } : SETUP;
    case "project":
      return t ? { route: "setup", target: { lens: t } } : SETUP;
    default:
      return SETUP;
  }
}
```

```ts
// src/App/navigation/index.ts
export { canGoBack, current, initialHistory, navReducer } from "./navigation";
export { resolveExternal } from "./legacy";
export type { NavAction, NavHistory, NavState } from "./navigation.types";
```

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/App/navigation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App/navigation
git commit -m "feat(ui): one navigation state with a back stack; legacy routes resolve to real places (#S5)"
```

### Task 5.2: The shell runs on navigation state; Back (⌘[ and a toolbar arrow)

**Files:**
- Create: `src/App/navigation/useNavigation.ts`, `useNavigation.test.ts`, `NavigationContext.ts`
- Create: `src/components/BackButton/{index.ts,BackButton.tsx,BackButton.types.ts,BackButton.test.tsx,BackButton.stories.tsx}`
- Modify: `src/App/App.tsx`, `App.types.ts`, `App.constants.ts`, `App.test.tsx`
- Modify: `src/screens/Setup/Setup.tsx` + `Setup.types.ts` (controlled by `target` + `onTargetChange`), `Setup.test.tsx`
- Modify: the `Setup`, `Projects` and `Settings` toolbars (render `<BackButton />` first)

**Interfaces:**
- Produces:
  - `useNavigation(): { state: NavState; canGoBack: boolean; navigate: Navigate; push: (s: NavState) => void; replace: (s: NavState) => void; back: () => void; closeItem: () => void }`. `navigate(route, target)` pushes `resolveExternal(route, target)`.
  - `NavigationContext` (value = the hook's return); `useBack(): { canGoBack: boolean; back: () => void }`
  - `Route = "setup" | "projects" | "settings"`. `Navigate = (route: Route | string, target?: string) => void` keeps accepting old strings through `resolveExternal`.
  - `SetupProps.onTargetChange?: (next: SetupTarget, mode: "push" | "replace") => void`
  - `SetupProps.onCloseItem?: () => void`

- [ ] **Step 1: Write the failing tests**

```ts
// src/App/navigation/useNavigation.test.ts
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useNavigation } from "./useNavigation";

describe("useNavigation", () => {
  it("navigates through the legacy resolver and goes back", () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.navigate("detail", "/code/web/CLAUDE.md"));
    expect(result.current.state).toEqual({ route: "setup", target: { open: { fileId: "/code/web/CLAUDE.md" }, tab: "findings" } });
    act(() => result.current.back());
    expect(result.current.state).toEqual({ route: "setup", target: {} });
  });

  it("goes back on ⌘[ but not while typing in a field", () => {
    const { result } = renderHook(() => useNavigation());
    act(() => result.current.navigate("projects"));
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    act(() => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true, bubbles: true })); });
    expect(result.current.state.route).toBe("projects");
    input.blur();
    act(() => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true })); });
    expect(result.current.state.route).toBe("setup");
  });
});
```

```tsx
// src/components/BackButton/BackButton.test.tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NavigationContext } from "@/App/navigation/NavigationContext";
import { BackButton } from "./BackButton";

const nav = (canGoBack: boolean, back = vi.fn()) => ({ canGoBack, back }) as never;

describe("BackButton", () => {
  it("goes back when there is somewhere to go", () => {
    const back = vi.fn();
    render(<NavigationContext.Provider value={nav(true, back)}><BackButton /></NavigationContext.Provider>);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalled();
  });
  it("renders nothing at the start of history", () => {
    render(<NavigationContext.Provider value={nav(false)}><BackButton /></NavigationContext.Provider>);
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});
```

Add these cases to `App.test.tsx`. Remove the `vi.mock` lines for deleted screens only in Task 5.5; here, keep them:

```tsx
it("lands a panel link to an old Detail route on the file's Findings", async () => {
  render(<App />);
  await emitNavigate({ route: "detail", target: "/code/web/CLAUDE.md" });
  expect(propsOf("setup").target).toEqual({ open: { fileId: "/code/web/CLAUDE.md" }, tab: "findings" });
});

it("opens the project lens for an old project route", async () => {
  render(<App />);
  await emitNavigate({ route: "project", target: "/code/web" });
  expect(propsOf("setup").target).toEqual({ lens: "/code/web" });
});
```

And in `Setup.test.tsx`, add a controlled-mode case:

```tsx
it("reports changes instead of holding them when it is controlled", () => {
  const onTargetChange = vi.fn();
  render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{}} onTargetChange={onTargetChange} />);
  fireEvent.click(screen.getByRole("radio", { name: /Skills/ }));
  expect(onTargetChange).toHaveBeenCalledWith({ kind: "skill" }, "push");
  fireEvent.click(screen.getAllByRole("row")[1]);
  expect(onTargetChange).toHaveBeenLastCalledWith(expect.objectContaining({ open: expect.anything() }), "push");
});

it("closes the viewer when the target loses its open item (Back)", () => {
  const { rerender } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ open: { artifactId: SKILL_ID } }} onTargetChange={vi.fn()} />);
  rerender(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{}} onTargetChange={vi.fn()} />);
  expect(screen.queryByRole("tablist", { name: /viewer/i })).toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/App src/components/BackButton src/screens/Setup/Setup.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/App/navigation/NavigationContext.ts
import { createContext, useContext } from "react";
import type { useNavigation } from "./useNavigation";

export const NavigationContext = createContext<ReturnType<typeof useNavigation> | null>(null);

/** Back, for any toolbar; inert outside the shell (stories, tests). */
export function useBack(): { canGoBack: boolean; back: () => void } {
  const nav = useContext(NavigationContext);
  return nav ?? { canGoBack: false, back: () => {} };
}
```

```ts
// src/App/navigation/useNavigation.ts
import { useCallback, useEffect, useReducer } from "react";
import type { Navigate } from "../App.types";
import { resolveExternal } from "./legacy";
import { canGoBack, current, initialHistory, navReducer } from "./navigation";
import type { NavState } from "./navigation.types";

const typing = (el: Element | null) =>
  el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || (el instanceof HTMLElement && el.isContentEditable);

export function useNavigation() {
  const [history, dispatch] = useReducer(navReducer, undefined, () => initialHistory());
  const push = useCallback((state: NavState) => dispatch({ type: "push", state }), []);
  const replace = useCallback((state: NavState) => dispatch({ type: "replace", state }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const closeItem = useCallback(() => dispatch({ type: "closeItem" }), []);
  const navigate = useCallback<Navigate>((route, target) => push(resolveExternal(route, target)), [push]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "[" && !typing(document.activeElement)) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  return { state: current(history), canGoBack: canGoBack(history), navigate, push, replace, back, closeItem };
}
```

`BackButton.tsx`: `const { canGoBack, back } = useBack(); if (!canGoBack) return null;`. It renders `<Button size="icon" aria-label="Back" onClick={back}><Icon name="chevronRight" style={{ transform: "rotate(180deg)" }} /></Button>`; if `Icon` has no `style` pass-through, add a `.back-button` CSS class that does the rotate.

`App.types.ts`:

```ts
export type Route = "setup" | "projects" | "settings";
/** Any route string is accepted; old ones resolve through `resolveExternal`. */
export type Navigate = (route: Route | (string & {}), target?: string) => void;
```

`App.constants.ts`: `ROUTES = ["setup", "projects", "settings"] as const`. Keep `isRoute`, which the Panel still type-checks against.

`App.tsx`:
- replace all per-screen state (`route`, `detailId`, `settingsTab`, `setupTarget`, `projectPath`, `rulesTab`, `rulesNewTarget`) with `const nav = useNavigation();`;
- in the `navigate` listener, drop the `isRoute` check and call `nav.navigate(payload.route, payload.target ?? undefined)`, so every route resolves;
- `finishOnboarding` calls `nav.push({ route: "setup", target: {} })`;
- render inside `<NavigationContext.Provider value={nav}>`:

```tsx
{nav.state.route === "setup" && (
  <Setup navigate={nav.navigate} target={nav.state.target}
    onTargetChange={(target, mode) => (mode === "push" ? nav.push : nav.replace)({ route: "setup", target })}
    onCloseItem={nav.closeItem} />
)}
{nav.state.route === "projects" && <Projects navigate={nav.navigate} />}
{nav.state.route === "settings" && <Settings navigate={nav.navigate} initialTab={nav.state.tab} />}
```

- the sidebar gets `active={nav.state.route}`;
- the UpdateBanner calls `nav.navigate("settings", "about")`.

Keep the old screens' render lines only until Task 5.5 deletes the screens; they are unreachable now, so remove them in this task if `tsc` allows.

`Setup.tsx` becomes controlled when `onTargetChange` is given:
- `kind`, `filter`, `lens`, `open` and `tab` are read from `target` (`target.kind ?? "all"`, and so on);
- a local `useState` fallback remains only for uncontrolled use (stories, tests without `onTargetChange`); put it behind a small `useSetupTarget(target, onTargetChange)` hook in `src/screens/Setup/useSetupTarget.ts` with its own test;
- changes to kind, filter, lens or open call `onTargetChange(next, "push")`, and tab changes call `"replace"`;
- closing the viewer calls `onCloseItem?.() ?? onTargetChange({...target, open: undefined, tab: undefined}, "push")`;
- resolving `target.open` to a row is a pure `useMemo`, so a target without `open` means no viewer.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/App src/components src/screens/Setup`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "feat(ui): the shell runs on navigation state; Back with ⌘[ and a toolbar arrow (#S5)"
```

### Task 5.3: Menu-bar panel links land in the new places

**Files:**
- Modify: `src/screens/Panel/Panel.tsx:48-80`, `src/screens/Panel/PanelSignals/PanelSignals.constants.ts:14-33`, `PanelSignals.types.ts` (`route: string`)
- Test: `src/screens/Panel/Panel.test.tsx`, `PanelSignals/PanelSignals.test.tsx`

**Interfaces:**
- Consumes: `formatSetupTarget` (2.7). `commands.openMain(route, target)` is unchanged; its payload resolves in `App` through `resolveExternal` (5.1).

- [ ] **Step 1: Write the failing tests**

```tsx
// PanelSignals.test.tsx (replace the route assertions)
it.each([
  [/never-used skill/i, "setup", "kind=skill&filter=never"],
  [/MCP server/i, "setup", "kind=mcp_server&filter=errors"],
  [/session/i, "projects", null],
])("%s opens %s %s", (name, route, target) => {
  const onOpen = vi.fn();
  render(<PanelSignals neverUsedSkills={2} mcpErroring={1} sessionsToday={3} onOpen={onOpen} />);
  fireEvent.click(screen.getByRole("button", { name }));
  expect(onOpen).toHaveBeenCalledWith(route, target);
});
```

```tsx
// Panel.test.tsx (add)
it("opens a fix on the file's Findings and Open app on Setup", () => {
  // commands.openMain mocked; render with a snapshot that has one top fix /code/web/CLAUDE.md
  fireEvent.click(screen.getByRole("button", { name: /CLAUDE\.md/ }));
  expect(openMain).toHaveBeenCalledWith("setup", "open=f%3A%2Fcode%2Fweb%2FCLAUDE.md&tab=findings");
  fireEvent.click(screen.getByRole("button", { name: /Open app/ }));
  expect(openMain).toHaveBeenLastCalledWith("setup", null);
});
```

Use the file's existing snapshot fixture, and its own mock of `commands.openMain`.

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/screens/Panel`
Expected: FAIL.

- [ ] **Step 3: Implement.**
  - **`PanelSignals.constants.ts`:** `target: "kind=skill&filter=never"` (was `"skill"`), `target: "kind=mcp_server&filter=errors"`, and `route: "projects", target: null` (was `analytics`). Build the strings with `formatSetupTarget({ kind: "skill", filter: "never" })` and so on, so the format lives in one place.
  - **`Panel.tsx`:** `onOpen={(fileId) => openMain("setup", formatSetupTarget({ open: { fileId }, tab: "findings" }) ?? null)}` and `onOpenApp={() => openMain("setup")}`.
  - **Types:** loosen `openMain(route: Route | string, …)`.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/screens/Panel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Panel
git commit -m "feat(panel): signals and fixes open Setup with the right kind, filter and item (#S5)"
```

### Task 5.4: Onboarding ends on Setup

**Files:**
- Modify: `src/components/Onboarding/Onboarding.tsx:13,183-215` (`STEPS` last label "Setup"; `Reveal` rewritten), `Onboarding.constants`, and whatever file holds its strings
- Create: `src/components/Onboarding/reveal.util.ts` + `reveal.util.test.ts`
- Modify: `src/components/Onboarding/useOnboarding.ts` (after the scan, load `getSetup()` + `listFiles()` for the reveal line)
- Test: `Onboarding.test.tsx`

**Interfaces:**
- Consumes: `setupRows` (2.2), `filterCounts` (existing).
- Produces: `revealLine(items: number, projects: number, never: number, erroring: number): string`

- [ ] **Step 1: Write the failing tests**

```ts
// reveal.util.test.ts
import { describe, expect, it } from "vitest";
import { revealLine } from "./reveal.util";

describe("revealLine", () => {
  it("reads like the spec's example", () => {
    expect(revealLine(84, 9, 3, 1)).toBe("84 items across 9 projects · 3 never used · 1 erroring");
  });
  it("drops zero counts and uses singulars", () => {
    expect(revealLine(1, 1, 0, 0)).toBe("1 item across 1 project");
  });
});
```

```tsx
// Onboarding.test.tsx (replace the reveal assertions)
it("ends on a Setup summary and an Open my setup button, not a grade", async () => {
  // drive to the reveal the way the existing reveal test does
  expect(await screen.findByText(/items across .* project/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open my setup" })).toBeInTheDocument();
  expect(screen.queryByText(/See what to fix/)).toBeNull();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm vitest run src/components/Onboarding`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// reveal.util.ts
const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "84 items across 9 projects · 3 never used · 1 erroring" (spec §12); zero counts are left out. */
export function revealLine(items: number, projects: number, never: number, erroring: number): string {
  const parts = [`${n(items, "item", "items")} across ${n(projects, "project", "projects")}`];
  if (never > 0) parts.push(`${never} never used`);
  if (erroring > 0) parts.push(`${erroring} erroring`);
  return parts.join(" · ");
}
```

`Reveal` drops `useVerdictHero`, `verdictSentence` and `ScoreRing`. It shows a heading "Your setup" and the `revealLine(...)` computed by `useOnboarding` after the scan: `setupRows(setup, files)` for the item count, `setup.projects.length`, and `filterCounts(rows, costThreshold(rows))` for never used and errors. The primary button reads "Open my setup" and calls `onDone`. `App.finishOnboarding` already lands on Setup (Task 5.2). Update the stories' reveal state.

- [ ] **Step 4: Run and pass**

Run: `pnpm vitest run src/components/Onboarding`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Onboarding
git commit -m "feat(onboarding): the reveal summarises the setup and opens it (#S5)"
```

### Task 5.5: Delete the old screens and dead components

**Files:**
- Delete:
  - **Screens:** `src/screens/{Overview,Prompts,Detail,Scans,Analytics,Project}`. Rules and RulesNew already moved in Task 1.6.
  - **Components:** `src/components/{VerdictHero,Heatmap,RadarChart}`.
  - **Deleted only if the grep in Step 1 shows no importer:** `src/components/RankedList`, `src/components/Sparkline` (ProjectStrip uses Sparkline, so it stays), `src/components/SeverityDot`/`SourceBadge` (Findings uses them, so they stay), `src/components/ArtifactCard`, `src/components/UsageBadge`, `src/components/ProviderIcon`, `src/components/ScreenPlaceholder`.
- Modify: `src/App/App.test.tsx` (drop mocks of deleted screens), `src/lib/useUpdateCheck` users, and any barrel re-exporting a deleted module
- Modify: `src/screens/Setup/useSetupTables.ts`, `setup.pills.ts` (`pillsFor`), `setup.columns.tsx` (`columnsFor`, `KIND_TABS`, `defaultSortFor`, `actionsColumn`, `sizeColumn`, `sessionsColumn`, `bundledColumn`). Delete whatever only the old tab tables and the Project screen used, together with its tests.

- [ ] **Step 1: Prove nothing live imports them**

```bash
for m in Overview Prompts Detail Scans Analytics Project; do
  echo "== screens/$m"; grep -rln "screens/$m[\"/]" src | grep -v "^src/screens/$m/"; done
for c in VerdictHero Heatmap RadarChart RankedList Sparkline ArtifactCard UsageBadge ProviderIcon ScreenPlaceholder SeverityDot SourceBadge; do
  echo "== components/$c"; grep -rln "components/$c[\"/]" src | grep -v "^src/components/$c/"; done
```

Expected: the screen lines list only `App.tsx`/`App.test.tsx`; remove those imports first. A component listed with a live importer outside the deleted screens stays.

- [ ] **Step 2: Delete, then fix what the compiler names**

```bash
git rm -r src/screens/Overview src/screens/Prompts src/screens/Detail src/screens/Scans src/screens/Analytics src/screens/Project
git rm -r src/components/VerdictHero src/components/Heatmap src/components/RadarChart
# plus each component Step 1 showed unreferenced
pnpm tsc --noEmit -p tsconfig.json
```

Fix every error by deleting the dead reference, never by recreating the module. `formatTrendDelta` already moved to TrendChart (Task 3.10). `MissingFolderBanner` already moved (Task 4.3). `useVerdictHero` has no remaining user after Task 5.4.

- [ ] **Step 3: Tests**

Run: `pnpm vitest run`
Expected: PASS. Delete the test files of deleted modules together with them. Remove the stubbed-screen `vi.mock` lines for deleted screens from `App.test.tsx`.

- [ ] **Step 4: Storybook still builds**

Run: `pnpm build-storybook` (or the exact storybook step `scripts/check.sh` runs; read it)
Expected: builds with no missing-story imports.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "chore(ui): remove Overview, Prompts, Detail, Scans, Analytics and Project screens and their dead components (#S5)"
```

### Task 5.6: Backend: remove commands nothing calls

**Files:**
- Modify:
  - `src-tauri/src/commands.rs`: remove the `get_scans_digest` and `get_usage_overview` wrappers
  - `src-tauri/src/command_names.rs`: remove both names
  - `src-tauri/src/ipc.rs`: remove both from `collect_commands!`
  - `src-tauri/capabilities/default.json`: remove `allow-get-scans-digest` and `allow-get-usage-overview`
- Modify: `src-tauri/src/harness_query.rs`. Remove `usage_overview`, its four tests, and the `UsageOverview`/`KindTotal`/`TargetRate`/`ProjectSessions` types. Keep any that `cargo build` shows are still used; `ProjectSessions` may be.
- Keep: `query::get_scans_digest` (`notify.rs`), `get_overview` (the panel and the grade badge), `get_analytics` (the grade popover), `get_effective_rules` + `get_project_usage` (the lens), `list_rules` (Checks).
- Regenerate: `src/lib/bindings.ts`. Remove deleted types from `src/lib/ipc.ts`.

- [ ] **Step 1: Prove no frontend caller remains**

```bash
grep -rn "getScansDigest\|getUsageOverview" src | grep -v "src/lib/bindings.ts"
```

Expected: no output. If there is output, a deleted screen was missed in 5.5; fix that first.

- [ ] **Step 2: Remove, regenerate, run the ACL tests**

Run: `cd src-tauri && cargo build && cargo test --lib && cargo test --test capabilities && cargo test --lib ipc::tests::export_typescript_bindings && cargo clippy --all-targets -- -D warnings`
Expected: PASS. `every_command_is_granted_to_some_window` and the drift test confirm that the names, the handler and the grants agree.

- [ ] **Step 3: Frontend still compiles against the new bindings**

Run: `pnpm tsc --noEmit -p tsconfig.json`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add -A src-tauri src/lib
git commit -m "chore(engine): drop get_scans_digest and get_usage_overview commands — no screen calls them (#S5)"
```

### Task 5.7: Copy sweep: no purchase text, one vocabulary, no wrong hints

**Files:**
- Create: `src/App/copy.sweep.test.tsx`

- [ ] **Step 1: Write the test** (it should pass; it is the regression guard §13a asks for)

```tsx
// src/App/copy.sweep.test.tsx
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: false,
  commands: {},
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
import { Settings } from "@/screens/Settings";
import { Setup } from "@/screens/Setup";
import { Projects } from "@/screens/Projects";
import { SETTINGS_TABS } from "@/screens/Settings/Settings.constants";
import { Findings } from "@/screens/Setup/Findings";

const PURCHASE = /\$\d|Get Pro|paid feature|License/;
const OLD_WORDS = /\bRules\b|Rescan|Add a folder|Overview tab|Prompts tab/;

describe("copy sweep (spec §3.3, §13a)", () => {
  it.each(SETTINGS_TABS.map((t) => t.id))("Settings → %s shows no purchase text", (tab) => {
    const { container } = render(<Settings navigate={vi.fn()} initialTab={tab} />);
    expect(container.textContent).not.toMatch(PURCHASE);
  });

  it("Setup, Projects and Findings use the glossary and no purchase text", () => {
    for (const ui of [<Setup navigate={vi.fn()} />, <Projects navigate={vi.fn()} />, <Findings fileId={null} onJumpToLine={vi.fn()} />]) {
      const { container, unmount } = render(ui);
      expect(container.textContent).not.toMatch(PURCHASE);
      expect(container.textContent).not.toMatch(OLD_WORDS);
      unmount();
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm vitest run src/App/copy.sweep.test.tsx`
Expected: PASS. If it fails, the failure names the string. Fix the component; never weaken the regex.

- [ ] **Step 3: Commit**

```bash
git add src/App/copy.sweep.test.tsx
git commit -m "test(ui): copy sweep — no purchase text, no retired words (#S5)"
```

### Task 5.8: Part 5 gate and real-build check (owner, spec §14)

- [ ] **Step 1: Full gate**

Run: `pnpm check`
Expected: `✔ all gates passed`.

- [ ] **Step 2: Bundled build.** The ACL and CSP are only enforced in a bundled build; mocked IPC is why #192 shipped.

Run: `pnpm tauri build --debug`
Expected: `Prompt Janitor.app` builds. Hand it to the owner with this checklist. Do not tick it on the owner's behalf.

**Owner checklist (real Mac, bundled build):**
1. The app opens on **Setup**. The sidebar reads Setup · Projects · Settings, then Recent.
2. The kind chips filter the table. "never used / erroring / costly" filter it, and clicking the same one again clears it.
3. The grade badge opens the trend. "Fix N issues automatically" runs and the counts update after the scan.
4. Open a skill, an agent, a CLAUDE.md, an MCP server and `settings.json`:
   - **Content** shows the file;
   - **Source** has numbered lines;
   - **Edit** appears for the skill, the agent and the CLAUDE.md only;
   - the MCP server shows no secret in clear.
5. On an instruction's **Findings**, clicking a finding opens Content → Source on that line.
6. **Usage** for a used skill shows uses per day and a per-project list; clicking a project switches the lens.
7. A graded file from an extra scan folder (no harness) shows under Instructions and opens read-only with its findings.
8. **Viewing → as Claude Code sees <project>**:
   - numbered instructions come first;
   - there are no other projects' items;
   - the usage numbers change;
   - Reveal in Finder works.
9. Recent and Projects rows open that lens.
10. **Back:** ⌘[ and the arrow walk back through lens, filter and open item. ✕ on the viewer returns to the table.
11. Menu-bar panel:
    - "never-used skills" opens Skills filtered to Never used;
    - "MCP erroring" opens MCP servers filtered to Erroring;
    - a fix row opens that file's Findings;
    - "sessions today" opens Projects.
12. **Settings:**
    - there are 6 tabs and no License tab;
    - Checks lists the built-in, custom and AI checks, and "Add check" works;
    - removing a folder shows the "Removes N projects…" confirmation.
13. Nowhere in the app shows "$69", "Get Pro" or "License".

- [ ] **Step 3: Commit** (nothing to commit unless the build surfaced a fix; any fix gets a test first and its own commit)

### Task 5.9: Status dashboard and the single PR

**Files:**
- Modify: `docs/status/data.json`, then `STATUS.html` via `pnpm status`

- [ ] **Step 1: Status**

```bash
python3 - <<'EOF'
import json
p = "docs/status/data.json"; d = json.load(open(p))
d["recent"].insert(0, "2026-09-27 — Phase 13 Setup-first navigation implemented on one branch (#S1–#S5): Setup is home with kind chips, summary filters and a project lens; the viewer has Content / Findings / Usage with editing for markdown kinds; Settings is Folders, Scanning, Notifications, Checks, AI, About; all paywall UI hidden; one navigation state with Back; Overview, Prompts, Detail, Scans, Analytics, Rules and Project screens removed. Awaiting owner review + real-build check.")
d["actions"]["blocking"].insert(0, {
  "title": "Review the Phase 13 PR and run its real-build checklist",
  "detail": "One PR closes #S1–#S5. Build with `pnpm tauri build --debug` and walk the 13-point checklist in the PR body on your Mac; the ACL and CSP only apply to a bundled build.",
  "kind": "testing",
})
open(p, "w").write(json.dumps(d, indent=2, ensure_ascii=False) + "\n")
EOF
pnpm status
```

Replace `#S1–#S5` with the real issue numbers from Task 0. Update the Vitest and cargo counts in the `health` section to the numbers the last `pnpm check` printed, following the existing entries' shape.

- [ ] **Step 2: Final gate on the final commit**

```bash
git add docs/status/data.json STATUS.html
git commit -m "chore(status): record Phase 13 Setup-first navigation (#S5)"
pnpm check
```

Expected: `✔ all gates passed` on this exact commit.

- [ ] **Step 3: Push and open the one PR**

```bash
git push -u origin feat/phase13-setup-first-navigation
gh pr create --base main --title "feat(ui): Setup-first navigation — three destinations, project lens, viewer tabs" --body-file - <<'EOF'
Closes #S1
Closes #S2
Closes #S3
Closes #S4
Closes #S5

Implements `docs/superpowers/specs/2026-09-27-setup-first-navigation-design.md` (plan: `docs/superpowers/plans/2026-09-27-setup-first-navigation.md`).

## What changes
- Sidebar is Setup (home) · Projects · Settings + Recent.
- One Setup table: kind chips, grade badge with trend + Fix N automatically, never used / erroring / costly filters, graded files the inventory never saw.
- Project lens replaces project pages: only what loads there, instructions in load order, that project's usage.
- Viewer: Content / Findings / Usage; agents, commands and markdown instructions editable; ⌘↑/⌘↓ stepping.
- Settings: Folders, Scanning, Notifications, Checks, AI, About. No paywall UI while PAYMENTS_ENABLED=false.
- One navigation state with Back (⌘[); legacy routes and panel links resolve.

## Backend
- New: get_artifact_usage, open_file, reveal_project (all granted in capabilities/default.json).
- Changed: ArtifactView/FileRow carry findings count + worst severity; RankedTarget.last_used; EDITABLE_KINDS += agent, command, markdown rule.
- Removed: get_scans_digest, get_usage_overview.

## Tests
<paste the final `pnpm check` summary: Vitest N/N, cargo N + 6, fulfillment 26/26>

## Real-build checklist (owner)
<paste the 13 points from Task 5.8>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Do not merge. The owner reviews and merges.
