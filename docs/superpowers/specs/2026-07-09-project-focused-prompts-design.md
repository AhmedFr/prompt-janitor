# Project-focused Prompts + repo-aware project detection

**Date:** 2026-07-09
**Status:** Approved, ready for planning

## Problem

The sidebar now lists projects and grades, but three gaps remain:

1. **Project detection is shallow.** A file's project is its *immediate parent
   folder* (`scan.rs::project_name`). A file nested below the repo root — e.g.
   `~/code/mobile/ios/AGENTS.md` — is mis-attributed to `ios` instead of
   `mobile`. We want 100% coverage: every file maps to the project that owns
   it, even when that project is an ancestor, not the direct parent.
2. **No project logo.** Projects always render a generic folder icon.
3. **The Prompts screen is a flat table.** The target design is
   project-grouped, with per-file provider icons and richer filtering, and the
   sidebar's project rows should deep-link into it.

## Decisions (locked)

- **Project root = git repo root**, via the existing `find_repo_root()` (git
  worktree root, else nearest manifest, else parent folder as a guaranteed
  fallback). A whole repo is one project.
- **Logo detection = best-effort**: probe a bounded set of logo files in the
  project root; use the first found, else a grade-tinted folder icon.
- **Deep-link = scroll-to-and-highlight** the project's group (does not hide
  the others).
- **Prompts filters = Provider, Grade, Sort**, plus the existing All/Flagged
  tabs and Search.

## Architecture

### Backend (Rust, `src-tauri`)

**Project detection — `scan.rs`**
- Replace `project_name(path) -> String` with a resolver that returns the
  project's `(id, name, root_path)`:
  - `root = find_repo_root(path).unwrap_or_else(|| path.parent())`.
  - `id = root` as an absolute path string (unique — two `api` repos don't
    collide), `name = root`'s final path component, `root_path = root`.
  - Reuse the existing `RootCache` so the walk is memoized per directory.
- `run_scan` persists `projects(id, name, root_path, ...)` with the new triple
  and sets `files.project_id = id`.
- Update the scan/query tests that assert `project_id = 'api-worker'` to the
  path-based id scheme (assert on `projects.name` instead).

**Logo detection — new `project_logo.rs`**
- `detect_logo(root: &Path) -> Option<String>` returns a base64 `data:` URI.
- Candidate files (first match wins), each `stat`-checked and size-capped
  (≤ 256 KB): in `root`, then `public/`, then `.github/` —
  `logo.{svg,png,jpg,jpeg,ico}`, `icon.{…}`, `favicon.{…}`.
- MIME inferred from extension; body base64-encoded. Reads are bounded and
  degrade to `None` on any error (matches the repo's "degrade gracefully"
  convention).
- Called once per project in `run_scan`, after the project row is roll-up
  updated.

**Schema — `store.rs`**
- Migration 5: `ALTER TABLE projects ADD COLUMN logo TEXT;` (NULL = none).

**Query surface — `query.rs`**
- Add `kind: String` to `FileRow`; `list_files` already selects `kind` — expose
  it. `list_files` now JOINs `projects` and returns `projects.name` as
  `project` (since `project_id` is a path).
- New `ProjectRow { id, name, grade, score, file_count, issue_count, logo,
  modified }` and `list_projects(conn) -> Vec<ProjectRow>`:
  - `file_count`/`issue_count` aggregated from `files`; `modified` = max
    `modified_at` in the project; ordered worst-grade-first then most-recent.
- New command `list_projects` registered in `commands.rs` + specta bindings
  regenerated.

### Frontend (React, `src`)

**`ProviderIcon` component** (new, folder-per-component)
- `kind -> { glyph, bg, label }` constants map. Renders a colored rounded
  square with a white brand glyph:
  - `CLAUDE.md` → terracotta + spark; `AGENTS.md` → near-black + robot;
    `.cursorrules` / `.mdc` → blue + cursor arrow; `GEMINI.md`, `.windsurfrules`,
    `.clinerules`, `.continuerules`, `copilot-instructions.md` → their marks;
    else a neutral file glyph.
- Inline SVG glyphs local to the component (brand-specific, not general Icons).

**Project rollup + logo rendering**
- `useSidebar` switches from deriving projects out of `listFiles` to calling
  `list_projects` (gives it logo + counts for free). Recent-projects cap and
  sort unchanged.
- A small `ProjectGlyph` helper renders the logo `data:` URI when present, else
  a grade-tinted folder icon (folder color = grade token). Used by both the
  sidebar and the Prompts group headers.

**Prompts redesign**
- `usePromptsList` hook: loads `list_projects` + `listFiles`, exposes the
  active tab (all/flagged), search text, provider filter, grade filter, sort
  key, and returns the filtered/sorted **groups** (`{ project, files[] }`).
- `Prompts.tsx` layout:
  - Toolbar: title, "Last scan · {relative}" (from `getOverview().last_scan`),
    **Scan now** button (`scanNow` on the configured folder; refetch on
    `scan-done`).
  - Row of controls: All/Flagged tabs, Search input, Provider/Grade/Sort
    dropdowns.
  - Group cards: `ProjectGlyph` + name + `Grade` + "N files · M issues";
    file rows: `ProviderIcon` + name + path + (`N issues` in red | `clean`) +
    `Grade` + relative age + chevron → `navigate("detail", file.id)`.
- **Deep-link**: `Prompts` accepts the `target` project id from `navigate`.
  On mount / target change, scroll that group into view and apply a transient
  highlight class (~1.2s). Others stay visible.

**Sidebar wiring**
- Widen `SidebarProps.onNavigate` to the full `Navigate` type; `App` passes
  `navigate` directly instead of `(r) => navigate(r)`.
- Project rows call `onNavigate("prompts", project.id)`.

## Data flow

```
scan_now → run_scan → scanner.scan_folder → per file:
    find_repo_root → (id,name,root_path) → projects row
    detect_logo(root_path) → projects.logo
    grade/score/issues → files + issues rows
frontend:
    list_projects → sidebar rollups + Prompts group headers (logo, counts)
    list_files (with kind, project name) → Prompts file rows (ProviderIcon)
    click sidebar project → navigate("prompts", id) → scroll+highlight group
```

## Error handling / edge cases

- No repo root and no parent (path is filesystem root): project name falls back
  to `"root"` (current behavior preserved).
- Logo file unreadable / too large / bad UTF-path: `detect_logo` returns `None`;
  UI shows the tinted folder.
- Not running under Tauri (tests, Storybook): `list_projects`/`listFiles` return
  empty; Prompts shows its existing empty/"open the desktop app" states.
- Same-named repos in different paths remain distinct projects (path-based id).
- A monorepo counts as a single project (per the locked decision); revisit
  `resolution_root` later if per-package grouping is wanted.

## Testing

- **Rust**: `project resolves to git repo root` (nested file → repo name);
  `falls back to parent folder outside a repo`; `same-named repos stay
  distinct`; `detect_logo finds root logo / respects size cap / returns None`;
  updated `run_scan` project-id assertions; `list_projects` rollup counts.
- **Frontend**: `ProviderIcon` renders the right label per kind;
  `usePromptsList` grouping/filter/sort logic (provider, grade, flagged,
  search, sort key) as pure-ish unit tests; `Prompts` renders groups + deep-link
  scroll/highlight (mock the hook, as done for `Sidebar`); a11y pass. Sidebar
  updated to `list_projects` with its existing mocked-hook tests.

## Out of scope

- Per-monorepo-package projects (`resolution_root`).
- User-configurable logo path / manual logo upload.
- Editing/opening a project folder from the group header.
