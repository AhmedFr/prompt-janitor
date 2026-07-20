# Project-focused Prompts + repo-aware project detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attribute every scanned file to the git repo that owns it, detect a per-project logo, and rebuild the Prompts screen as a project-grouped, filterable list that the sidebar deep-links into.

**Architecture:** Rust scan pipeline resolves a file's project via the existing `find_repo_root()` (repo root, else parent folder), stores a per-project logo `data:` URI, and exposes a `list_projects` rollup command. The React frontend adds a `ProviderIcon` (per file `kind`) and `ProjectGlyph` (logo or grade-tinted folder), swaps the flat Prompts table for project group cards with Provider/Grade/Sort filters, and lets sidebar project clicks scroll-and-highlight a group.

**Tech Stack:** Rust (rusqlite, git2, ignore, tauri-specta), React 18 + TypeScript, Vite, Vitest + Testing Library, Storybook, plain CSS with design tokens.

## Global Constraints

- Package manager: **pnpm** (`pnpm test`, `pnpm typecheck`, `pnpm lint`).
- Rust tests: `cd src-tauri && cargo test`.
- Component convention: one folder per component with `Name.tsx`, `Name.types.ts`, optional `Name.constants.ts(x)`, `Name.test.tsx`, `Name.stories.tsx`, `index.ts`.
- Bindings `src/lib/bindings.ts` are **generated** by the `export_typescript_bindings` test in `src-tauri/src/ipc.rs` (run `cargo test`); never hand-maintain them long-term. Import IPC from `@/lib/ipc`, never from `bindings` directly.
- Frontend must render outside Tauri (tests/Storybook): `isTauri` guards return empty data.
- Grade color tokens: `--grade-a..f`. Blue accent: `--blue`. Muted text: `--text-3`.
- Degrade gracefully: a backend probe that fails returns `None`, never panics.

---

## File Structure

**Backend (`src-tauri/src/`)**
- `store.rs` — migration 5: `projects.logo`.
- `project_logo.rs` — NEW: `detect_logo(root) -> Option<String>`.
- `scan.rs` — `resolve_project()` (repo-aware) + persist logo; modified.
- `query.rs` — `FileRow.kind`, `list_files` join for project name; NEW `ProjectRow` + `list_projects`.
- `commands.rs` — NEW `list_projects` command.
- `ipc.rs` — register `list_projects`; regenerates bindings.
- `lib.rs` — declare `mod project_logo;`.

**Frontend (`src/`)**
- `lib/ipc.ts` — re-export `ProjectRow`.
- `components/ProviderIcon/` — NEW.
- `components/ProjectGlyph/` — NEW.
- `components/Sidebar/` — `useSidebar.ts`, `Sidebar.tsx`, `Sidebar.types.ts` modified.
- `App/App.tsx` — pass `navigate` directly to Sidebar.
- `screens/Prompts/` — NEW `usePromptsList.ts`; `Prompts.tsx`, `Prompts.css` rebuilt.

---

## Task 1: Migration — `projects.logo` column

**Files:**
- Modify: `src-tauri/src/store.rs` (append to `MIGRATIONS`)

**Interfaces:**
- Produces: `projects.logo TEXT` (NULL = no logo).

- [ ] **Step 1: Add the migration**

Append a 6th entry to the `MIGRATIONS` array in `store.rs` (after the migration-4 string, before the closing `];`):

```rust
    // 5: projects.logo — a base64 data: URI of a logo detected in the project
    // root at scan time (NULL when none found). Lets the UI show a real
    // project mark instead of a generic folder.
    "
    ALTER TABLE projects ADD COLUMN logo TEXT;
    ",
```

- [ ] **Step 2: Add a test**

Add to `store.rs`'s `#[cfg(test)] mod tests` (create the module if absent — mirror the pattern used elsewhere):

```rust
    #[test]
    fn migration_adds_project_logo_column() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        // A column that only exists after migration 5.
        conn.execute("UPDATE projects SET logo = 'x' WHERE 1=0", [])
            .expect("logo column should exist");
    }
```

- [ ] **Step 3: Run it**

Run: `cd src-tauri && cargo test store::`
Expected: PASS (all store tests, including the new one).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/store.rs
git commit -m "feat(db): add projects.logo column (migration 5)"
```

---

## Task 2: `project_logo.rs` — logo detection

**Files:**
- Create: `src-tauri/src/project_logo.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod project_logo;`)

**Interfaces:**
- Produces: `pub fn detect_logo(root: &std::path::Path) -> Option<String>` — a `data:<mime>;base64,<...>` URI, or `None`.

- [ ] **Step 1: Declare the module**

In `src-tauri/src/lib.rs`, add alongside the other `mod` declarations:

```rust
mod project_logo;
```

- [ ] **Step 2: Write failing tests**

Create `src-tauri/src/project_logo.rs`:

```rust
//! Best-effort project logo detection. Given a project root, look for a small
//! set of conventional logo files and return the first as a base64 `data:`
//! URI. Bounded, size-capped, and degrades to `None` on any error.

use std::path::Path;

use base64::Engine;

/// Max logo size we inline (256 KB). Larger files are skipped.
const MAX_BYTES: u64 = 256 * 1024;

/// Directories under the project root to probe, in order.
const DIRS: &[&str] = &["", "public", ".github"];

/// Base names to try in each dir, in order.
const NAMES: &[&str] = &["logo", "icon", "favicon"];

/// Extension → MIME. Order also sets preference (svg first).
const EXTS: &[(&str, &str)] = &[
    ("svg", "image/svg+xml"),
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("ico", "image/x-icon"),
];

/// Return a `data:` URI for the project's logo, or `None`.
pub fn detect_logo(root: &Path) -> Option<String> {
    for dir in DIRS {
        let base = if dir.is_empty() { root.to_path_buf() } else { root.join(dir) };
        for name in NAMES {
            for (ext, mime) in EXTS {
                let candidate = base.join(format!("{name}.{ext}"));
                if let Some(uri) = try_read(&candidate, mime) {
                    return Some(uri);
                }
            }
        }
    }
    None
}

fn try_read(path: &Path, mime: &str) -> Option<String> {
    let meta = std::fs::metadata(path).ok()?;
    if !meta.is_file() || meta.len() > MAX_BYTES {
        return None;
    }
    let bytes = std::fs::read(path).ok()?;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Some(format!("data:{mime};base64,{b64}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_root_logo_and_encodes_data_uri() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("logo.png"), b"\x89PNG\r\n").unwrap();
        let uri = detect_logo(dir.path()).unwrap();
        assert!(uri.starts_with("data:image/png;base64,"));
    }

    #[test]
    fn prefers_svg_over_png() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("logo.png"), b"png").unwrap();
        fs::write(dir.path().join("logo.svg"), b"<svg/>").unwrap();
        assert!(detect_logo(dir.path()).unwrap().starts_with("data:image/svg+xml"));
    }

    #[test]
    fn looks_in_public_dir() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("public")).unwrap();
        fs::write(dir.path().join("public/icon.png"), b"x").unwrap();
        assert!(detect_logo(dir.path()).is_some());
    }

    #[test]
    fn skips_oversize_file() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("logo.png"), vec![0u8; (MAX_BYTES + 1) as usize]).unwrap();
        assert!(detect_logo(dir.path()).is_none());
    }

    #[test]
    fn none_when_no_logo() {
        let dir = tempfile::tempdir().unwrap();
        assert!(detect_logo(dir.path()).is_none());
    }
}
```

- [ ] **Step 3: Ensure the `base64` dependency is present**

Run: `cd src-tauri && cargo tree -i base64 2>/dev/null | head -1`
If it prints nothing, add it: `cd src-tauri && cargo add base64`.
(`tempfile` is already a dev-dependency — it's used across the existing tests.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test project_logo::`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/project_logo.rs src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat(scan): detect a project logo file as a data URI"
```

---

## Task 3: Repo-aware project resolution + expose `kind`

**Files:**
- Modify: `src-tauri/src/scan.rs` (`project_name` → `resolve_project`, persistence, logo, tests)
- Modify: `src-tauri/src/query.rs` (`FileRow.kind`, `list_files` join)

**Interfaces:**
- Consumes: `crate::repo_root::find_repo_root`, `crate::project_logo::detect_logo`.
- Produces: `projects` rows keyed by absolute root path (`id = root_path`, `name = basename`); `FileRow` gains `pub kind: String`; `list_files` returns `project = projects.name`.

- [ ] **Step 1: Replace `project_name` with `resolve_project` in `scan.rs`**

Replace the `project_name` fn (currently scan.rs:152-159) with:

```rust
/// Resolve the project that owns `path`: `(id, name, root_path)`.
///
/// The project root is the git worktree root (or nearest manifest) from
/// `find_repo_root`; a loose file with no root falls back to its parent
/// folder, so every file maps to a project. `id` is the absolute root path
/// (unique — two same-named repos stay distinct); `name` is the root's final
/// path component.
fn resolve_project(path: &Path, roots: &mut RootCache) -> (String, String, String) {
    let root = roots
        .repo_root_for(path)
        .unwrap_or_else(|| path.parent().map(|p| p.to_path_buf()).unwrap_or_default());
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "root".to_string());
    let root_path = root.display().to_string();
    (root_path.clone(), name, root_path)
}
```

- [ ] **Step 2: Use it in `run_scan` and store the logo**

In `run_scan`, the loop already computes `repo_root`/`resolution_root` via `roots`. Replace the `let project = project_name(...)` line (scan.rs:222) and the two `projects`/`files` inserts (scan.rs:225-243) with:

```rust
        let (project_id, project_name, project_root) = resolve_project(file_path, &mut roots);
        let issue_count = issues.len() + carried_nl.len();

        let logo = crate::project_logo::detect_logo(Path::new(&project_root));
        conn.execute(
            "INSERT OR IGNORE INTO projects(id, name, root_path, logo) VALUES(?1, ?2, ?3, ?4)",
            params![project_id, project_name, project_root, logo],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at, content_hash)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                file.path,
                project_id,
                file.path,
                file.kind,
                grade.letter(),
                score as i64,
                issue_count as i64,
                file.modified_unix.map(|m| m.to_string()),
                hash,
            ],
        )?;
```

Then update the two later references to `project` (the `project_scores.entry(project)` at scan.rs:284 and any others) to use `project_id`. Search the function for `project` and replace the score-map key with `project_id`.

Note: `roots` is currently borrowed twice per iteration (`repo_root_for`, `resolution_root_for`) before the `ctx` is built. `resolve_project` borrows `roots` again after `ctx` is dropped — fine since `ctx` holds `&PathBuf` clones via `as_deref()` on locals, not `roots`. If the borrow checker complains, hoist `resolve_project` to just after `repo_root`/`resolution_root` are computed.

- [ ] **Step 3: Update `scan.rs` tests to the path-based id scheme**

The tests query `WHERE project_id = 'api-worker'`. Since `project_id` is now a path, switch them to join on the name. Replace the three `project_id = 'api-worker'` / `'web-app'` queries in `run_scan_persists_graded_files` with a name join, e.g.:

```rust
        let focal_grade: String = conn
            .query_row(
                "SELECT f.grade FROM files f JOIN projects p ON p.id = f.project_id
                 WHERE p.name = 'api-worker'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(focal_grade, "D");
```

Apply the same join to the `issue_count` and `web-app` assertions.

Replace the `project_is_the_immediate_parent_folder` test with repo-aware coverage:

```rust
    #[test]
    fn project_resolves_to_repo_root_else_parent() {
        use std::fs;
        // Inside a git repo: a nested file resolves to the repo root name.
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        fs::create_dir_all(dir.path().join("ios")).unwrap();
        let nested = dir.path().join("ios/AGENTS.md");
        fs::write(&nested, "x").unwrap();
        let mut roots = RootCache::default();
        let (_, name, _) = resolve_project(&nested, &mut roots);
        let repo_name = dir.path().file_name().unwrap().to_string_lossy().into_owned();
        assert_eq!(name, repo_name);

        // Outside any repo/manifest: fall back to the immediate parent folder.
        let loose = tempfile::tempdir().unwrap();
        if git2::Repository::discover(loose.path()).is_err() {
            fs::create_dir_all(loose.path().join("scripts")).unwrap();
            let f = loose.path().join("scripts/CLAUDE.md");
            fs::write(&f, "x").unwrap();
            let (_, name, _) = resolve_project(&f, &mut RootCache::default());
            assert_eq!(name, "scripts");
        }
    }
```

- [ ] **Step 4: Add `kind` to `FileRow` and join in `list_files` (`query.rs`)**

In `FileRow` (query.rs:197-209) add after `project`:

```rust
    /// File classification (e.g. `CLAUDE.md`, `AGENTS.md`, `.cursorrules`) —
    /// drives the provider icon in the UI.
    pub kind: String,
```

Rewrite `list_files` (query.rs:212-241) to join `projects` for the name and to return `kind`:

```rust
pub fn list_files(conn: &Connection) -> rusqlite::Result<Vec<FileRow>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.path, f.kind, p.name, f.grade, f.score, f.issue_count, f.modified_at
         FROM files f JOIN projects p ON p.id = f.project_id
         ORDER BY CASE f.grade WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3 ELSE 4 END,
                  p.name, f.kind",
    )?;
    let rows = stmt
        .query_map([], |r| {
            let path: String = r.get(1)?;
            let kind: String = r.get(2)?;
            let name = std::path::Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or(kind.as_str())
                .to_string();
            Ok(FileRow {
                id: r.get(0)?,
                name,
                path: path.clone(),
                project: r.get(3)?,
                kind,
                grade: grade_from_db(&r.get::<_, String>(4)?),
                score: r.get::<_, i64>(5)? as u32,
                issue_count: r.get::<_, i64>(6)? as u32,
                modified: r.get::<_, Option<String>>(7)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}
```

- [ ] **Step 5: Fix any `list_files` tests in `query.rs`**

Search `query.rs` tests for direct `INSERT INTO files(... project_id ...)` fixtures that insert a `project_id` without a matching `projects` row — the new JOIN drops orphan files. For each such fixture, also insert the project, e.g. before the file insert:

```rust
    conn.execute("INSERT INTO projects(id, name, root_path) VALUES('p', 'p', '/p')", []).unwrap();
```

(The existing fixtures already use `project_id = 'p'`; add the matching `projects` row with `id='p'`.) Run the tests to find exactly which need it.

- [ ] **Step 6: Run backend tests**

Run: `cd src-tauri && cargo test`
Expected: PASS (scan + query + store + project_logo).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/scan.rs src-tauri/src/query.rs
git commit -m "feat(scan): resolve project to the repo root; expose file kind"
```

---

## Task 4: `list_projects` command + rollups + bindings

**Files:**
- Modify: `src-tauri/src/query.rs` (`ProjectRow`, `list_projects`)
- Modify: `src-tauri/src/commands.rs` (`list_projects` command)
- Modify: `src-tauri/src/ipc.rs` (register command)
- Generated: `src/lib/bindings.ts`
- Modify: `src/lib/ipc.ts` (re-export `ProjectRow`)

**Interfaces:**
- Produces: `ProjectRow { id, name, grade, score, file_count, issue_count, logo: Option<String>, modified: Option<String> }`; command `list_projects() -> ProjectRow[]`. TS: `commands.listProjects()`, type `ProjectRow`.

- [ ] **Step 1: Add `ProjectRow` + `list_projects` with a failing test (`query.rs`)**

Add near `FileRow`:

```rust
/// A project rollup for the sidebar and the Prompts group headers.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ProjectRow {
    pub id: String,
    pub name: String,
    pub grade: Grade,
    pub score: u32,
    pub file_count: u32,
    pub issue_count: u32,
    /// Base64 `data:` URI of the project's logo, if one was detected.
    pub logo: Option<String>,
    /// Most recent file mtime in the project (epoch seconds string).
    pub modified: Option<String>,
}

/// Every project with its rolled-up file/issue counts, worst-grade first.
pub fn list_projects(conn: &Connection) -> rusqlite::Result<Vec<ProjectRow>> {
    let mut stmt = conn.prepare(
        "SELECT p.id, p.name, p.grade, p.score, p.logo,
                COUNT(f.id), COALESCE(SUM(f.issue_count), 0), MAX(f.modified_at)
         FROM projects p LEFT JOIN files f ON f.project_id = p.id
         GROUP BY p.id
         ORDER BY CASE p.grade WHEN 'A' THEN 0 WHEN 'B' THEN 1 WHEN 'C' THEN 2 WHEN 'D' THEN 3 ELSE 4 END,
                  MAX(f.modified_at) DESC",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(ProjectRow {
                id: r.get(0)?,
                name: r.get(1)?,
                grade: grade_from_db(&r.get::<_, Option<String>>(2)?.unwrap_or_else(|| "F".into())),
                score: r.get::<_, Option<i64>>(3)?.unwrap_or(0) as u32,
                logo: r.get(4)?,
                file_count: r.get::<_, i64>(5)? as u32,
                issue_count: r.get::<_, i64>(6)? as u32,
                modified: r.get::<_, Option<String>>(7)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}
```

Add a test in `query.rs` tests:

```rust
    #[test]
    fn list_projects_rolls_up_counts() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn.execute("INSERT INTO projects(id, name, root_path, grade, score) VALUES('/a','a','/a','D',52)", []).unwrap();
        conn.execute("INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at) VALUES('/a/CLAUDE.md','/a','/a/CLAUDE.md','CLAUDE.md','D',52,5,'100')", []).unwrap();
        conn.execute("INSERT INTO files(id, project_id, path, kind, grade, score, issue_count, modified_at) VALUES('/a/AGENTS.md','/a','/a/AGENTS.md','AGENTS.md','F',40,6,'200')", []).unwrap();
        let projects = list_projects(&conn).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].file_count, 2);
        assert_eq!(projects[0].issue_count, 11);
        assert_eq!(projects[0].modified.as_deref(), Some("200"));
    }
```

- [ ] **Step 2: Add the command (`commands.rs`)**

After the `list_files` command (commands.rs:579):

```rust
/// Every project with its rolled-up counts and detected logo.
#[tauri::command]
#[specta::specta]
pub fn list_projects(db: tauri::State<'_, AppDb>) -> Result<Vec<query::ProjectRow>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    query::list_projects(&conn).map_err(|e| e.to_string())
}
```

- [ ] **Step 3: Register it (`ipc.rs`)**

Add to the `collect_commands![…]` list (after `crate::commands::list_files,`):

```rust
        crate::commands::list_projects,
```

- [ ] **Step 4: Regenerate bindings + run tests**

Run: `cd src-tauri && cargo test`
Expected: PASS, and `src/lib/bindings.ts` now contains `listProjects` and `ProjectRow` (the `export_typescript_bindings` test rewrites it). Verify: `grep -c "listProjects\|ProjectRow" src/lib/bindings.ts` → ≥ 2.

- [ ] **Step 5: Re-export the type (`src/lib/ipc.ts`)**

Add `ProjectRow` to the `export type { … } from "./bindings";` block (next to `FileRow`).

- [ ] **Step 6: Frontend typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/query.rs src-tauri/src/commands.rs src-tauri/src/ipc.rs src/lib/bindings.ts src/lib/ipc.ts
git commit -m "feat(ipc): add list_projects rollup command"
```

---

## Task 5: `ProviderIcon` component

**Files:**
- Create: `src/components/ProviderIcon/{ProviderIcon.tsx,ProviderIcon.types.ts,ProviderIcon.constants.tsx,ProviderIcon.css,ProviderIcon.test.tsx,ProviderIcon.stories.tsx,index.ts}`

**Interfaces:**
- Produces: `<ProviderIcon kind={string} size?={number} />`. `PROVIDERS: Record<string, {label,bg,glyph}>` keyed by file `kind`, with a neutral fallback.

- [ ] **Step 1: Types**

`ProviderIcon.types.ts`:

```ts
export interface ProviderIconProps {
  /** File kind from the scan (e.g. "CLAUDE.md", "AGENTS.md", ".cursorrules"). */
  kind: string;
  /** Square size in px. Default 26. */
  size?: number;
}

export interface ProviderMeta {
  label: string;
  /** Background color of the rounded square. */
  bg: string;
  /** White-stroked/filled glyph, drawn on a 24×24 grid. */
  glyph: React.ReactNode;
}
```

- [ ] **Step 2: Constants (glyphs + colors)**

`ProviderIcon.constants.tsx` — a map from kind to meta, plus a fallback. Glyphs are inline SVG children (rendered inside a 24×24 `<svg>`):

```tsx
import type { ProviderMeta } from "./ProviderIcon.types";

const claudeSpark = (
  <path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8z" fill="#fff" stroke="none" />
);
const robot = (
  <>
    <rect x="5" y="8" width="14" height="10" rx="3" fill="#fff" stroke="none" />
    <circle cx="9.5" cy="13" r="1.4" fill="#111" stroke="none" />
    <circle cx="14.5" cy="13" r="1.4" fill="#111" stroke="none" />
    <line x1="12" y1="4.5" x2="12" y2="8" stroke="#fff" strokeWidth="1.6" />
  </>
);
const cursor = (
  <path d="M7 5l11 6-4.6 1.4L11 18z" fill="#fff" stroke="none" />
);
const gemini = (
  <path d="M12 4c.6 4 2 5.4 6 6-4 .6-5.4 2-6 6-.6-4-2-5.4-6-6 4-.6 5.4-2 6-6z" fill="#fff" stroke="none" />
);
const fileGlyph = (
  <path d="M7 4h7l4 4v12H7z" fill="none" stroke="#fff" strokeWidth="1.7" />
);

export const PROVIDERS: Record<string, ProviderMeta> = {
  "CLAUDE.md": { label: "Claude", bg: "#c96442", glyph: claudeSpark },
  "AGENTS.md": { label: "Agents", bg: "#1c1c1e", glyph: robot },
  "GEMINI.md": { label: "Gemini", bg: "#3186ff", glyph: gemini },
  ".cursorrules": { label: "Cursor", bg: "#0a84ff", glyph: cursor },
  "cursor-rule": { label: "Cursor", bg: "#0a84ff", glyph: cursor },
  ".windsurfrules": { label: "Windsurf", bg: "#0aa37f", glyph: fileGlyph },
  ".clinerules": { label: "Cline", bg: "#5b5bd6", glyph: fileGlyph },
  ".continuerules": { label: "Continue", bg: "#111827", glyph: fileGlyph },
  "copilot-instructions.md": { label: "Copilot", bg: "#24292f", glyph: fileGlyph },
};

export const FALLBACK_PROVIDER: ProviderMeta = { label: "File", bg: "#8e8e93", glyph: fileGlyph };
```

- [ ] **Step 3: Component + CSS**

`ProviderIcon.tsx`:

```tsx
import type { ProviderIconProps } from "./ProviderIcon.types";
import { PROVIDERS, FALLBACK_PROVIDER } from "./ProviderIcon.constants";
import "./ProviderIcon.css";

/** A colored rounded-square brand mark for a prompt file's provider. */
export function ProviderIcon({ kind, size = 26 }: ProviderIconProps) {
  const meta = PROVIDERS[kind] ?? FALLBACK_PROVIDER;
  return (
    <span
      className="provider-icon"
      style={{ width: size, height: size, background: meta.bg }}
      role="img"
      aria-label={meta.label}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden="true">
        {meta.glyph}
      </svg>
    </span>
  );
}
```

`ProviderIcon.css`:

```css
.provider-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  flex: 0 0 auto;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
```

`index.ts`:

```ts
export { ProviderIcon } from "./ProviderIcon";
export { PROVIDERS, FALLBACK_PROVIDER } from "./ProviderIcon.constants";
export type { ProviderIconProps } from "./ProviderIcon.types";
```

- [ ] **Step 4: Test**

`ProviderIcon.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ProviderIcon } from "./ProviderIcon";

describe("ProviderIcon", () => {
  afterEach(cleanup);

  it("labels known kinds by provider", () => {
    const { getByRole } = render(<ProviderIcon kind="CLAUDE.md" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "Claude");
  });

  it("labels .cursorrules as Cursor", () => {
    const { getByRole } = render(<ProviderIcon kind=".cursorrules" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "Cursor");
  });

  it("falls back to File for unknown kinds", () => {
    const { getByRole } = render(<ProviderIcon kind="whatever" />);
    expect(getByRole("img")).toHaveAttribute("aria-label", "File");
  });
});
```

- [ ] **Step 5: Story**

`ProviderIcon.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { ProviderIcon } from "./ProviderIcon";
import { PROVIDERS } from "./ProviderIcon.constants";

const meta = { title: "Components/ProviderIcon", component: ProviderIcon } satisfies Meta<typeof ProviderIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const All: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 10 }}>
      {Object.keys(PROVIDERS).map((k) => (
        <ProviderIcon key={k} kind={k} />
      ))}
    </div>
  ),
};
```

- [ ] **Step 6: Run + commit**

Run: `pnpm test src/components/ProviderIcon && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add src/components/ProviderIcon
git commit -m "feat(ui): add ProviderIcon brand marks per file kind"
```

---

## Task 6: `ProjectGlyph` component (logo or grade-tinted folder)

**Files:**
- Create: `src/components/ProjectGlyph/{ProjectGlyph.tsx,ProjectGlyph.types.ts,ProjectGlyph.css,ProjectGlyph.test.tsx,index.ts}`

**Interfaces:**
- Consumes: `Grade` from `@/lib/ipc`, `Icon` (folder).
- Produces: `<ProjectGlyph name grade logo?={string|null} size?={number} />` — an `<img>` of the logo when present, else a grade-tinted folder square.

- [ ] **Step 1: Types**

```ts
import type { Grade } from "@/lib/ipc";

export interface ProjectGlyphProps {
  name: string;
  grade: Grade;
  /** Detected logo data URI, if any. */
  logo?: string | null;
  /** Square size in px. Default 26. */
  size?: number;
}
```

- [ ] **Step 2: Component + CSS**

`ProjectGlyph.tsx`:

```tsx
import { Icon } from "@/components/Icon";
import type { ProjectGlyphProps } from "./ProjectGlyph.types";
import "./ProjectGlyph.css";

/** A project's visual mark: its detected logo, else a grade-tinted folder. */
export function ProjectGlyph({ name, grade, logo, size = 26 }: ProjectGlyphProps) {
  if (logo) {
    return (
      <img className="project-glyph project-glyph--logo" src={logo} alt="" width={size} height={size} />
    );
  }
  return (
    <span
      className={`project-glyph project-glyph--folder grade-tint--${grade.toLowerCase()}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name} project`}
    >
      <Icon name="folder" size={size * 0.6} />
    </span>
  );
}
```

`ProjectGlyph.css` (uses grade tokens for tint):

```css
.project-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  flex: 0 0 auto;
}
.project-glyph--logo {
  object-fit: cover;
  background: var(--group);
}
.project-glyph--folder { --tint: var(--grade-c); color: var(--tint); background: color-mix(in srgb, var(--tint) 14%, transparent); }
.grade-tint--a { --tint: var(--grade-a); }
.grade-tint--b { --tint: var(--grade-b); }
.grade-tint--c { --tint: var(--grade-c); }
.grade-tint--d { --tint: var(--grade-d); }
.grade-tint--f { --tint: var(--grade-f); }
```

`index.ts`:

```ts
export { ProjectGlyph } from "./ProjectGlyph";
export type { ProjectGlyphProps } from "./ProjectGlyph.types";
```

- [ ] **Step 3: Test**

```tsx
import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ProjectGlyph } from "./ProjectGlyph";

describe("ProjectGlyph", () => {
  afterEach(cleanup);

  it("renders the logo image when provided", () => {
    const { container } = render(<ProjectGlyph name="web-app" grade="A" logo="data:image/png;base64,xx" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "data:image/png;base64,xx");
  });

  it("renders a grade-tinted folder when no logo", () => {
    const { getByRole } = render(<ProjectGlyph name="scripts" grade="F" />);
    const el = getByRole("img");
    expect(el).toHaveAttribute("aria-label", "scripts project");
    expect(el.className).toContain("grade-tint--f");
  });
});
```

- [ ] **Step 4: Run + commit**

Run: `pnpm test src/components/ProjectGlyph && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add src/components/ProjectGlyph
git commit -m "feat(ui): add ProjectGlyph (logo or grade-tinted folder)"
```

---

## Task 7: Sidebar — list_projects data, logo, deep-link

**Files:**
- Modify: `src/components/Sidebar/useSidebar.ts`
- Modify: `src/components/Sidebar/Sidebar.types.ts`
- Modify: `src/components/Sidebar/Sidebar.tsx`
- Modify: `src/components/Sidebar/Sidebar.test.tsx`
- Modify: `src/App/App.tsx`

**Interfaces:**
- Consumes: `commands.listProjects`, `ProjectRow`, `ProjectGlyph`, `Navigate`.
- Produces: `SidebarProject` gains `id` and `logo`; `SidebarProps.onNavigate: Navigate`.

- [ ] **Step 1: Widen the nav type (`Sidebar.types.ts`)**

Replace the `onNavigate` field and extend `SidebarProject`:

```ts
import type { Navigate, Route } from "@/App/App.types";
import type { Grade } from "@/lib/ipc";
import type { IconName } from "@/components/Icon";

export interface SidebarProps {
  active: Route;
  /** Navigate to a route, optionally with a target (e.g. a project id). */
  onNavigate: Navigate;
  onReplay?: () => void;
}

export interface NavItem {
  route: Route;
  label: string;
  icon: IconName;
}

export interface SidebarProject {
  id: string;
  name: string;
  grade: Grade;
  logo: string | null;
  modified: string | null;
}

export type NavCounts = Partial<Record<Route, number>>;
```

- [ ] **Step 2: Load `list_projects` (`useSidebar.ts`)**

Replace the file-derived rollup with a direct `listProjects` call (keeps counts from files + rules):

```ts
import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri } from "@/lib/ipc";
import { RECENT_PROJECTS_LIMIT } from "./Sidebar.constants";
import type { NavCounts, SidebarProject } from "./Sidebar.types";

export function useSidebar() {
  const [projects, setProjects] = useState<SidebarProject[]>([]);
  const [counts, setCounts] = useState<NavCounts>({});

  const refetch = useCallback(async () => {
    if (!isTauri) return;
    const [projectsRes, files, rules] = await Promise.all([
      commands.listProjects(),
      commands.listFiles(),
      commands.listRules(),
    ]);
    if (projectsRes.status === "ok") {
      setProjects(
        projectsRes.data.slice(0, RECENT_PROJECTS_LIMIT).map((p) => ({
          id: p.id,
          name: p.name,
          grade: p.grade,
          logo: p.logo,
          modified: p.modified,
        })),
      );
    }
    if (files.status === "ok") setCounts((prev) => ({ ...prev, prompts: files.data.length }));
    if (rules.status === "ok") setCounts((prev) => ({ ...prev, rules: rules.data.length }));
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => void refetch());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { projects, counts };
}
```

(`list_projects` already orders worst-grade-first then most-recent; the slice keeps the recent cap. Remove the now-unused `toProjects`/`byModifiedDesc`/scoring imports.)

- [ ] **Step 3: Render logo + deep-link (`Sidebar.tsx`)**

Replace the project button's folder Icon + grade span with `ProjectGlyph`, and pass the project id on click:

```tsx
import { Icon } from "@/components/Icon";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import type { SidebarProps } from "./Sidebar.types";
import { NAV_ITEMS } from "./Sidebar.constants";
import { useSidebar } from "./useSidebar";
```

In the projects map, replace the button body:

```tsx
              <button
                key={project.id}
                type="button"
                className="sidebar__item sidebar__item--project"
                onClick={() => onNavigate("prompts", project.id)}
              >
                <ProjectGlyph name={project.name} grade={project.grade} logo={project.logo} size={18} />
                <span className="sidebar__item-label">{project.name}</span>
                <span
                  className={`sidebar__grade sidebar__grade--${project.grade.toLowerCase()}`}
                  aria-label={`Grade ${project.grade}`}
                >
                  {project.grade}
                </span>
              </button>
```

- [ ] **Step 4: App passes `navigate` directly (`App/App.tsx`)**

Change the Sidebar usage (App.tsx:40):

```tsx
      <Sidebar active={route} onNavigate={navigate} onReplay={() => setShowOnboarding(true)} />
```

- [ ] **Step 5: Update the Sidebar test fixtures (`Sidebar.test.tsx`)**

The mocked `SidebarProject` objects now need `id` and `logo`. Update each fixture, e.g.:

```tsx
      projects: [
        { id: "/web-app", name: "web-app", grade: "A", logo: null, modified: "200" },
        { id: "/scripts", name: "scripts", grade: "F", logo: null, modified: "100" },
      ],
```

And assert the deep-link passes the id:

```tsx
  it("routes a project click to Prompts with the project id", () => {
    const onNavigate = vi.fn();
    mockSidebar.mockReturnValue({
      counts: {},
      projects: [{ id: "/web-app", name: "web-app", grade: "A", logo: null, modified: "200" }],
    });
    const { getByRole } = render(<Sidebar active="overview" onNavigate={onNavigate} />);
    getByRole("button", { name: /web-app/ }).click();
    expect(onNavigate).toHaveBeenCalledWith("prompts", "/web-app");
  });
```

Update the `mockSidebar` generic's `projects` element type if it's inlined, and the other fixtures likewise.

- [ ] **Step 6: Run + commit**

Run: `pnpm test src/components/Sidebar && pnpm lint && pnpm typecheck`
Expected: PASS.

```bash
git add src/components/Sidebar src/App/App.tsx
git commit -m "feat(sidebar): load project rollups, show logos, deep-link to Prompts"
```

---

## Task 8: `usePromptsList` — grouping, filtering, sorting

**Files:**
- Create: `src/screens/Prompts/usePromptsList.ts`
- Create: `src/screens/Prompts/usePromptsList.test.ts`
- Create: `src/screens/Prompts/Prompts.types.ts`

**Interfaces:**
- Consumes: `commands.listFiles`, `commands.listProjects`, `FileRow`, `ProjectRow`, `isTauri`.
- Produces: pure helper `buildGroups(files, projects, filters)` and hook `usePromptsList()`; types `PromptFilters`, `ProjectGroup`.

- [ ] **Step 1: Types (`Prompts.types.ts`)**

```ts
import type { FileRow, ProjectRow, Grade } from "@/lib/ipc";

export type PromptTab = "all" | "flagged";
export type PromptSort = "grade" | "issues" | "recent";

export interface PromptFilters {
  tab: PromptTab;
  search: string;
  provider: string | null; // file kind, or null for any
  grade: Grade | null;
  sort: PromptSort;
}

export interface ProjectGroup {
  project: ProjectRow;
  files: FileRow[];
}
```

- [ ] **Step 2: Write failing tests for `buildGroups` (`usePromptsList.test.ts`)**

```ts
import { describe, it, expect } from "vitest";
import { buildGroups } from "./usePromptsList";
import type { FileRow, ProjectRow } from "@/lib/ipc";

const proj = (id: string, name: string, grade: ProjectRow["grade"], issues = 0): ProjectRow => ({
  id, name, grade, score: 50, file_count: 0, issue_count: issues, logo: null, modified: "100",
});
const file = (id: string, project: string, kind: string, grade: FileRow["grade"], issues = 0, modified = "100"): FileRow => ({
  id, name: kind, path: `/x/${project}/${kind}`, project, kind, grade, score: 50, issue_count: issues, modified,
});

const F = {
  tab: "all", search: "", provider: null, grade: null, sort: "grade",
} as const;

describe("buildGroups", () => {
  const projects = [proj("/a", "api", "D", 11), proj("/b", "web", "A", 0)];
  const files = [
    file("/a/CLAUDE.md", "api", "CLAUDE.md", "D", 5),
    file("/b/AGENTS.md", "web", "AGENTS.md", "A", 0),
  ];

  it("groups files under their project, worst grade first", () => {
    const groups = buildGroups(files, projects, { ...F });
    expect(groups.map((g) => g.project.name)).toEqual(["api", "web"]);
    expect(groups[0].files).toHaveLength(1);
  });

  it("flagged tab keeps only files with issues and non-empty groups", () => {
    const groups = buildGroups(files, projects, { ...F, tab: "flagged" });
    expect(groups.map((g) => g.project.name)).toEqual(["api"]);
  });

  it("provider filter keeps only matching kinds", () => {
    const groups = buildGroups(files, projects, { ...F, provider: "AGENTS.md" });
    expect(groups.map((g) => g.project.name)).toEqual(["web"]);
  });

  it("grade filter keeps only matching file grades", () => {
    const groups = buildGroups(files, projects, { ...F, grade: "A" });
    expect(groups.flatMap((g) => g.files).map((f) => f.id)).toEqual(["/b/AGENTS.md"]);
  });

  it("search matches file name, path, or project name", () => {
    const groups = buildGroups(files, projects, { ...F, search: "web" });
    expect(groups.map((g) => g.project.name)).toEqual(["web"]);
  });

  it("sort=issues orders groups by issue_count desc", () => {
    const groups = buildGroups(files, projects, { ...F, sort: "issues" });
    expect(groups[0].project.name).toBe("api");
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm test src/screens/Prompts/usePromptsList.test.ts`
Expected: FAIL ("buildGroups is not a function").

- [ ] **Step 4: Implement `usePromptsList.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type FileRow, type ProjectRow } from "@/lib/ipc";
import type { ProjectGroup, PromptFilters } from "./Prompts.types";

const GRADE_RANK: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

/** Pure grouping/filter/sort so it can be unit-tested without Tauri. */
export function buildGroups(
  files: FileRow[],
  projects: ProjectRow[],
  filters: PromptFilters,
): ProjectGroup[] {
  const q = filters.search.trim().toLowerCase();
  const matches = (f: FileRow) => {
    if (filters.tab === "flagged" && f.issue_count === 0) return false;
    if (filters.provider && f.kind !== filters.provider) return false;
    if (filters.grade && f.grade !== filters.grade) return false;
    if (q && !(`${f.name} ${f.path} ${f.project}`.toLowerCase().includes(q))) return false;
    return true;
  };

  const byProject = new Map<string, FileRow[]>();
  for (const f of files) {
    if (!matches(f)) continue;
    const bucket = byProject.get(f.project);
    if (bucket) bucket.push(f);
    else byProject.set(f.project, [f]);
  }

  const groups: ProjectGroup[] = projects
    .filter((p) => byProject.has(p.name))
    .map((p) => ({ project: p, files: byProject.get(p.name) ?? [] }));

  const cmp: Record<PromptFilters["sort"], (a: ProjectGroup, b: ProjectGroup) => number> = {
    grade: (a, b) => GRADE_RANK[a.project.grade] - GRADE_RANK[b.project.grade],
    issues: (a, b) => b.project.issue_count - a.project.issue_count,
    recent: (a, b) => Number(b.project.modified ?? 0) - Number(a.project.modified ?? 0),
  };
  return groups.sort(cmp[filters.sort]);
}

/** Loads files + project rollups and refetches after each scan. */
export function usePromptsList() {
  const [files, setFiles] = useState<FileRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setLoading(false);
      return;
    }
    const [f, p] = await Promise.all([commands.listFiles(), commands.listProjects()]);
    if (f.status === "ok") setFiles(f.data);
    if (p.status === "ok") setProjects(p.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => void refetch());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  return { files, projects, loading, refetch };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/screens/Prompts/usePromptsList.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add src/screens/Prompts/usePromptsList.ts src/screens/Prompts/usePromptsList.test.ts src/screens/Prompts/Prompts.types.ts
git commit -m "feat(prompts): grouping/filter/sort logic (usePromptsList)"
```

---

## Task 9: Prompts screen — project-grouped layout + deep-link

**Files:**
- Modify: `src/screens/Prompts/Prompts.tsx`
- Modify: `src/screens/Prompts/Prompts.css`
- Create: `src/screens/Prompts/Prompts.test.tsx`

**Interfaces:**
- Consumes: `usePromptsList`, `buildGroups`, `ProviderIcon`, `ProjectGlyph`, `Grade`, `relativeTime`, `commands.scanNow`/`getScanFolder`/`getOverview`, `Navigate`, `PromptFilters`.
- Produces: `Prompts({ navigate, target })` where `target?` is the project id to scroll to.

- [ ] **Step 1: Accept a scroll `target` prop**

`App/App.tsx` already stores a nav target for `detail`/`settings`. Add a `promptsTarget` the same way: in `navigate`, `if (next === "prompts") setPromptsTarget(target);` with `const [promptsTarget, setPromptsTarget] = useState<string | undefined>(undefined);`, and pass `target={promptsTarget}` to `<Prompts>`. Update `PromptsProps`:

```tsx
export interface PromptsProps {
  navigate: Navigate;
  /** Project id to scroll to and highlight (from a sidebar deep-link). */
  target?: string;
}
```

- [ ] **Step 2: Rebuild `Prompts.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Grade } from "@/components/Grade";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import { commands, isTauri, type Grade as GradeT } from "@/lib/ipc";
import { relativeTime } from "@/lib/format";
import type { Navigate } from "@/App/App.types";
import { usePromptsList, buildGroups } from "./usePromptsList";
import type { PromptFilters } from "./Prompts.types";
import "./Prompts.css";

export interface PromptsProps {
  navigate: Navigate;
  target?: string;
}

const GRADES: GradeT[] = ["A", "B", "C", "D", "F"];

export function Prompts({ navigate, target }: PromptsProps) {
  const { files, projects, loading, refetch } = usePromptsList();
  const [filters, setFilters] = useState<PromptFilters>({
    tab: "all", search: "", provider: null, grade: null, sort: "grade",
  });
  const set = (patch: Partial<PromptFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const groups = useMemo(() => buildGroups(files, projects, filters), [files, projects, filters]);
  const flaggedCount = useMemo(() => files.filter((f) => f.issue_count > 0).length, [files]);

  // Deep-link: scroll to and briefly highlight the target project group.
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlighted, setHighlighted] = useState<string | null>(null);
  useEffect(() => {
    if (!target) return;
    const el = groupRefs.current[target];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlighted(target);
    const t = setTimeout(() => setHighlighted(null), 1200);
    return () => clearTimeout(t);
  }, [target, groups]);

  const scanNow = async () => {
    const folder = await commands.getScanFolder();
    if (folder.status === "ok" && folder.data) {
      await commands.scanNow(folder.data);
      void refetch();
    }
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Prompts</h1>
        <span className="toolbar-spacer" />
        {isTauri && (
          <Button size="sm" onClick={scanNow}>
            <Icon name="refresh" /> Scan now
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 1000 }}>
          {!isTauri ? (
            <Card padded><div className="muted">Open the desktop app to see your prompts.</div></Card>
          ) : loading ? (
            <Card padded><div className="muted">Loading…</div></Card>
          ) : files.length === 0 ? (
            <Card padded><div className="muted">No prompts yet — scan a folder from the Overview tab.</div></Card>
          ) : (
            <>
              <div className="p-controls">
                <div className="row" style={{ gap: 7 }}>
                  <button className={"p-chip" + (filters.tab === "all" ? " p-chip--on" : "")} onClick={() => set({ tab: "all" })}>
                    All · {files.length}
                  </button>
                  <button className={"p-chip" + (filters.tab === "flagged" ? " p-chip--on" : "")} onClick={() => set({ tab: "flagged" })}>
                    Flagged · {flaggedCount}
                  </button>
                </div>
                <span className="toolbar-spacer" />
                <select className="p-select" aria-label="Provider" value={filters.provider ?? ""} onChange={(e) => set({ provider: e.target.value || null })}>
                  <option value="">All providers</option>
                  <option value="CLAUDE.md">Claude</option>
                  <option value="AGENTS.md">Agents</option>
                  <option value=".cursorrules">Cursor</option>
                  <option value="GEMINI.md">Gemini</option>
                </select>
                <select className="p-select" aria-label="Grade" value={filters.grade ?? ""} onChange={(e) => set({ grade: (e.target.value || null) as GradeT | null })}>
                  <option value="">All grades</option>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="p-select" aria-label="Sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value as PromptFilters["sort"] })}>
                  <option value="grade">Worst grade</option>
                  <option value="issues">Most issues</option>
                  <option value="recent">Recently modified</option>
                </select>
                <input className="p-search" type="search" placeholder="Search" aria-label="Search prompts"
                  value={filters.search} onChange={(e) => set({ search: e.target.value })} />
              </div>

              {groups.map(({ project, files: pf }) => (
                <div
                  key={project.id}
                  ref={(el) => { groupRefs.current[project.id] = el; }}
                  className={"p-group" + (highlighted === project.id ? " p-group--hl" : "")}
                >
                  <div className="p-group__head">
                    <ProjectGlyph name={project.name} grade={project.grade} logo={project.logo} />
                    <span className="p-group__name">{project.name}</span>
                    <Grade grade={project.grade} size="sm" />
                    <span className="toolbar-spacer" />
                    <span className="faint">
                      {project.file_count} file{project.file_count === 1 ? "" : "s"}
                      {project.issue_count > 0 && ` · ${project.issue_count} issues`}
                    </span>
                  </div>
                  <Card style={{ overflow: "hidden" }}>
                    {pf.map((f) => (
                      <button key={f.id} className="p-row" onClick={() => navigate("detail", f.id)}>
                        <ProviderIcon kind={f.kind} />
                        <span className="p-row__main">
                          <span className="p-row__name">{f.name}</span>
                          <span className="p-row__path faint">{f.path}</span>
                        </span>
                        <span className={"p-row__issues" + (f.issue_count > 0 ? " p-row__issues--bad" : "")}>
                          {f.issue_count > 0 ? `${f.issue_count} issues` : "clean"}
                        </span>
                        <Grade grade={f.grade} size="sm" />
                        <span className="faint tnum p-row__age">{relativeTime(f.modified)}</span>
                        <Icon name="chevronRight" size={15} />
                      </button>
                    ))}
                  </Card>
                </div>
              ))}

              {groups.length === 0 && <Card padded><div className="muted">No prompts match these filters.</div></Card>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
```

(Removed the template picker to keep this screen focused on the project view; the template flow remains reachable from the empty-state and Overview. If you want to keep the "Start from a template" button, re-add the `TemplatePicker` block from git history — out of scope here.)

- [ ] **Step 3: Replace `Prompts.css`**

```css
.p-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.p-select, .p-search {
  font-size: 12px;
  padding: 5px 9px;
  border-radius: var(--r-ctrl);
  border: 0.5px solid var(--sep-strong);
  background: #fff;
  color: var(--text);
}
.p-search { min-width: 140px; }

.p-chip {
  font-size: 12px; padding: 4px 11px; border-radius: var(--r-pill);
  border: 0.5px solid var(--sep-strong); background: #fff; color: var(--text-2); cursor: pointer;
}
.p-chip--on { background: var(--blue); color: #fff; border-color: transparent; }

.p-group { margin-bottom: 20px; border-radius: var(--r-card); transition: box-shadow 0.3s ease; }
.p-group--hl { box-shadow: 0 0 0 2px var(--blue); }
.p-group__head { display: flex; align-items: center; gap: 9px; padding: 4px 4px 10px; }
.p-group__name { font-family: var(--font-display); font-weight: 600; font-size: 14px; }

.p-row {
  display: flex; align-items: center; gap: 11px; width: 100%;
  padding: 10px 14px; border: none; background: transparent; text-align: left;
  border-bottom: 0.5px solid var(--sep); cursor: pointer;
}
.p-row:last-child { border-bottom: none; }
.p-row:hover { background: var(--group); }
.p-row__main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.p-row__name { font-size: 13px; font-weight: 500; }
.p-row__path { font-family: var(--mono); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.p-row__issues { font-size: 12px; color: var(--text-3); }
.p-row__issues--bad { color: var(--red); font-weight: 500; }
.p-row__age { width: 34px; text-align: right; }
```

- [ ] **Step 4: Test (`Prompts.test.tsx`)** — mock the hook, like Sidebar

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Prompts } from "./Prompts";
import type { FileRow, ProjectRow } from "@/lib/ipc";

vi.mock("@/lib/ipc", async (orig) => {
  const mod = await orig<typeof import("@/lib/ipc")>();
  return { ...mod, isTauri: true };
});

const projects: ProjectRow[] = [
  { id: "/api", name: "api", grade: "D", score: 52, file_count: 1, issue_count: 5, logo: null, modified: "200" },
];
const files: FileRow[] = [
  { id: "/api/CLAUDE.md", name: "CLAUDE.md", path: "/api/CLAUDE.md", project: "api", kind: "CLAUDE.md", grade: "D", score: 52, issue_count: 5, modified: "200" },
];
vi.mock("./usePromptsList", async (orig) => {
  const mod = await orig<typeof import("./usePromptsList")>();
  return { ...mod, usePromptsList: () => ({ files, projects, loading: false, refetch: vi.fn() }) };
});

describe("Prompts", () => {
  afterEach(cleanup);

  it("renders a project group with its file row", () => {
    const { getByText, getByRole } = render(<Prompts navigate={vi.fn()} />);
    expect(getByText("api")).toBeInTheDocument();
    expect(getByRole("button", { name: /CLAUDE\.md/ })).toBeInTheDocument();
  });

  it("navigates to detail on row click", () => {
    const navigate = vi.fn();
    const { getByRole } = render(<Prompts navigate={navigate} />);
    getByRole("button", { name: /CLAUDE\.md/ }).click();
    expect(navigate).toHaveBeenCalledWith("detail", "/api/CLAUDE.md");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Prompts navigate={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

- [ ] **Step 5: Run everything**

Run: `pnpm test src/screens/Prompts && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Prompts src/App/App.tsx
git commit -m "feat(prompts): project-grouped layout with provider icons, filters, deep-link"
```

---

## Task 10: Full verification pass

- [ ] **Step 1: Backend**

Run: `cd src-tauri && cargo test`
Expected: PASS.

- [ ] **Step 2: Frontend**

Run: `pnpm test && pnpm lint && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Visual check (Storybook)**

Start Storybook (`pnpm storybook`), screenshot the `Components/ProviderIcon` and `Components/Sidebar` stories to confirm the marks render. (Prompts + deep-link need Tauri data; covered by unit tests.)

- [ ] **Step 4: If clean, the branch is ready for review/PR.**

---

## Self-review notes

- **Spec coverage:** project detection→T3; logo detection→T2/T3; `list_projects`→T4; ProviderIcon→T5; ProjectGlyph/tinted folder→T6; sidebar logo+deep-link→T7; Prompts grouping/filters/sort→T8/T9; scroll+highlight→T9; migration→T1. All spec sections mapped.
- **Type consistency:** `ProjectRow` fields (`id,name,grade,score,file_count,issue_count,logo,modified`) identical across T4/T7/T8/T9. `SidebarProject` gains `id,logo` in T7 and its test fixtures updated in the same task. `buildGroups(files, projects, filters)` signature identical in T8 definition and T9 use.
- **Known follow-ups (out of scope):** "Start from a template" button dropped from the Prompts toolbar (still reachable elsewhere); monorepo per-package grouping deferred.
