//! One harness-driven scan, split so the slow part holds no database lock:
//! [`prepare`] (reads the DB) → [`index`] (parses logs, touches no DB) →
//! [`commit`] (writes everything back). [`run_harness_scan`] runs the three in
//! a row for callers that already hold the connection.
//!
//! The outcome carries what the *file* grader still has to do: the project
//! roots to walk and the loose rule files (the global `CLAUDE.md`) to read.

use std::path::{Path, PathBuf};

use rusqlite::Connection;

use crate::harness::model::{Artifact, ProjectRef, UsageBatch, UsageCursor};
use crate::harness::{Harness, Scope};
use crate::harness_store as hs;

#[derive(Debug, Default)]
pub struct HarnessScanOutcome {
    pub roots: Vec<PathBuf>,
    pub extra_files: Vec<PathBuf>,
    pub skipped_lines: u64,
    /// The same total, attributed to the harness that skipped the lines — a
    /// single number cannot say which log parser is struggling.
    pub skipped_lines_by_harness: Vec<(String, u64)>,
    pub failed_files: u64,
    pub harness_count: u32,
    pub project_count: u32,
    /// Project scopes whose inventory came back empty while the database still
    /// held artifacts for them: an unreadable directory, not an emptied one.
    pub skipped_scopes: u32,
    /// Usage batches dropped because another pass had already committed the
    /// same bytes while this one was parsing.
    pub stale_batches: u32,
}

/// Everything one harness contributes to a scan, gathered before the usage
/// index runs so [`index`] can run without the database lock.
pub struct PreparedHarness {
    pub id: String,
    pub display_name: String,
    pub detected: bool,
    pub home_root: Option<PathBuf>,
    pub projects: Vec<ProjectRef>,
    pub global_inventory: Vec<Artifact>,
    /// `(project path, artifacts)` for every project that exists on disk and
    /// does not own the harness home itself.
    pub project_inventories: Vec<(String, Vec<Artifact>)>,
    /// Advanced in place by [`index`] — where the next pass should resume.
    pub cursor: UsageCursor,
    /// The same cursor as it stood in the database when this pass was
    /// prepared. [`commit`] re-reads it to tell whether another pass got
    /// there first.
    pub stored_cursor: UsageCursor,
}

/// `<project>/.claude == <harness home>` — the project *is* the directory the
/// harness keeps its home in (the user's home, for Claude Code). Its project
/// layer would just be the global layer again, filed under a project path.
fn owns_the_harness_home(project: &str, home_root: Option<&Path>) -> bool {
    home_root.and_then(Path::parent) == Some(Path::new(project))
}

/// The user's home directory, as written and as canonicalised — a project path
/// read off a log may be either.
fn user_homes() -> Vec<PathBuf> {
    let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
        return Vec::new();
    };
    let canonical = home.canonicalize().ok().filter(|c| c != &home);
    let mut out = vec![home];
    out.extend(canonical);
    out
}

/// The roots the file walker may descend from, sorted and deduplicated.
///
/// A slug can resolve to something far too broad to walk — the user's home
/// itself, or the directory the harness home sits in — and the walker would
/// then recurse over the entire disk. Such roots are dropped here, and so is
/// any root nested inside another (the walker reaches it from the parent).
/// The project rows themselves are kept regardless: their usage history has to
/// keep resolving.
///
/// The folders the user added by hand go through here too: a picked `$HOME`
/// is exactly as unwalkable as a slug that resolved to one.
///
/// Every comparison below — home match, ancestor-of-harness-home, nested-under-
/// another-root, dedupe — is judged on the CANONICAL form of each candidate: a
/// root reached through a symlink has to be judged as what it points at,
/// `~/shortcut -> ~` is the home directory under another name, and a
/// path-prefix test can't see through the link. But the ORIGINAL path string
/// is what gets returned. `artifacts.file_id` for a project's rule files is
/// built from that same original, non-canonicalized project path; if the
/// walker were pointed at the canonical root instead, the files it stores
/// would carry canonical ids and the `artifacts.file_id = files.id` join
/// would break for any project reached through a symlink. When two candidates
/// canonicalize to the same path, the first occurrence (by input order) wins.
pub(crate) fn scan_roots(candidates: Vec<PathBuf>, home_roots: &[PathBuf]) -> Vec<PathBuf> {
    let homes = user_homes();
    let mut kept: Vec<(PathBuf, PathBuf)> = candidates
        .into_iter()
        .map(|r| {
            let canonical = r.canonicalize().unwrap_or_else(|_| r.clone());
            (r, canonical)
        })
        .filter(|(_, canonical)| {
            // The filesystem root has no parent.
            canonical.parent().is_some()
                && !homes.contains(canonical)
                && !home_roots.iter().any(|h| h.starts_with(canonical))
        })
        .collect();
    // Stable sort on the canonical form: candidates that resolve to the same
    // path stay in their original relative order, so the dedup below keeps
    // the first occurrence.
    kept.sort_by(|(_, a), (_, b)| a.cmp(b));
    kept.dedup_by(|(_, a), (_, b)| a == b);
    let mut out: Vec<(PathBuf, PathBuf)> = Vec::new();
    for (original, canonical) in kept {
        if out.iter().any(|(_, outer)| canonical.starts_with(outer)) {
            continue;
        }
        out.push((original, canonical));
    }
    out.into_iter().map(|(original, _)| original).collect()
}

/// How many of `inventory`'s artifacts were read out of `project` itself.
///
/// A project's layer also carries things declared elsewhere — the MCP servers
/// in `~/.claude.json` are filed under the project they are configured for —
/// and those keep being listed when the project directory cannot be read at
/// all. Only an artifact backed by a file inside the project is evidence that
/// the walk actually worked.
fn file_derived(project: &Path, inventory: &[Artifact]) -> usize {
    use crate::harness::model::ArtifactKind as Kind;
    inventory
        .iter()
        .filter(|a| {
            matches!(
                a.kind,
                Kind::Rule
                    | Kind::Skill
                    | Kind::Agent
                    | Kind::Command
                    | Kind::Settings
                    | Kind::Hook
            ) && Path::new(&a.path).starts_with(project)
        })
        .count()
}

/// Step 1 — read each harness off the filesystem and pick up its usage cursor.
/// The only database access is [`hs::load_cursor`].
pub fn prepare(
    conn: &Connection,
    harnesses: &[Box<dyn Harness>],
) -> rusqlite::Result<Vec<PreparedHarness>> {
    let mut out = Vec::with_capacity(harnesses.len());
    for h in harnesses {
        // `detect()` hits the filesystem — ask once.
        let detected = h.detect();
        let home_root = h.home_root();
        let mut prepared = PreparedHarness {
            id: h.id().to_string(),
            display_name: h.display_name().to_string(),
            detected,
            home_root: home_root.clone(),
            projects: Vec::new(),
            global_inventory: Vec::new(),
            project_inventories: Vec::new(),
            cursor: UsageCursor::default(),
            stored_cursor: UsageCursor::default(),
        };
        if detected {
            prepared.projects = h.projects();
            prepared.global_inventory = h.inventory(&Scope::Global);
            // A project recorded in the harness's history may no longer exist
            // on disk; inventory and grading both skip it, but the row stays so
            // its usage history keeps resolving.
            prepared.project_inventories = prepared
                .projects
                .iter()
                .filter(|p| p.exists && !owns_the_harness_home(&p.path, home_root.as_deref()))
                .map(|p| (p.path.clone(), h.inventory(&Scope::Project(p.path.clone()))))
                .collect();
            prepared.cursor = hs::load_cursor(conn, h.id())?;
            prepared.stored_cursor = prepared.cursor.clone();
        }
        out.push(prepared);
    }
    Ok(out)
}

/// Step 2 — parse the logs. The expensive step, and the reason for the split:
/// it reads no database and so needs no lock.
pub fn index(
    harnesses: &[Box<dyn Harness>],
    prepared: Vec<PreparedHarness>,
) -> Vec<(PreparedHarness, UsageBatch)> {
    prepared
        .into_iter()
        .map(|mut p| {
            let batch = match harnesses.iter().find(|h| h.id() == p.id) {
                Some(h) if p.detected => h.index_usage(&mut p.cursor),
                _ => UsageBatch::default(),
            };
            (p, batch)
        })
        .collect()
}

/// Step 3 — write the pass back: harness rows, projects, inventory, usage, and
/// the rebuilt rollup, then report what the file grader still has to do.
pub fn commit(
    conn: &Connection,
    indexed: &[(PreparedHarness, UsageBatch)],
    now_epoch_secs: i64,
) -> rusqlite::Result<HarnessScanOutcome> {
    let now = now_epoch_secs.to_string();
    let mut out = HarnessScanOutcome::default();
    let home_roots: Vec<PathBuf> = indexed
        .iter()
        .filter(|(p, _)| p.detected)
        .filter_map(|(p, _)| p.home_root.clone())
        .collect();
    let mut candidate_roots: Vec<PathBuf> = Vec::new();

    for (p, batch) in indexed {
        hs::upsert_harness(conn, &p.id, &p.display_name, p.detected, &now)?;
        if !p.detected {
            continue;
        }
        out.harness_count += 1;

        hs::upsert_projects(conn, &p.projects)?;
        out.project_count += p.projects.len() as u32;
        candidate_roots.extend(
            p.projects
                .iter()
                .filter(|proj| proj.exists)
                .map(|proj| PathBuf::from(&proj.path)),
        );

        out.extra_files.extend(
            p.global_inventory
                .iter()
                .filter(|a| a.kind == crate::harness::model::ArtifactKind::Rule)
                .map(|a| PathBuf::from(&a.path)),
        );
        hs::replace_artifacts(conn, &p.id, &Scope::Global, &p.global_inventory, &now)?;

        for (path, artifacts) in &p.project_inventories {
            let scope = Scope::Project(path.clone());
            // Nothing read *out of the project* where the database already
            // holds something means the directory could not be read, not that
            // it was emptied — rewriting the scope would delete a live
            // inventory. Artifacts declared elsewhere survive an unreadable
            // project and would otherwise mask the failure.
            if file_derived(Path::new(path), artifacts) == 0
                && hs::count_artifacts(conn, &p.id, &scope)? > 0
            {
                out.skipped_scopes += 1;
                continue;
            }
            hs::replace_artifacts(conn, &p.id, &scope, artifacts, &now)?;
        }

        out.skipped_lines += batch.skipped_lines;
        out.skipped_lines_by_harness
            .push((p.id.clone(), batch.skipped_lines));
        out.failed_files += batch.failed_files;
        // Another pass committed while this one was parsing: it stored the
        // rows this batch re-read, and merging them on top would count every
        // session in the overlap twice. The cursor it left behind is ahead of
        // ours, so the next pass picks up from there.
        if hs::load_cursor(conn, &p.id)? == p.stored_cursor {
            hs::store_usage(conn, batch, &p.cursor)?;
        } else {
            out.stale_batches += 1;
        }
        hs::link_invocations_to_artifacts(conn, &p.id)?;
        hs::rebuild_usage_stats(conn, &p.id, now_epoch_secs)?;
    }

    out.roots = scan_roots(candidate_roots, &home_roots);
    Ok(out)
}

/// [`prepare`] → [`index`] → [`commit`] in one call, under whatever lock the
/// caller already holds. The app runs the three steps separately so the log
/// parsing happens unlocked; tests, which have the connection to themselves,
/// want the convenience.
#[cfg(test)]
pub fn run_harness_scan(
    conn: &Connection,
    harnesses: &[Box<dyn Harness>],
    now_epoch_secs: i64,
) -> rusqlite::Result<HarnessScanOutcome> {
    let prepared = prepare(conn, harnesses)?;
    let indexed = index(harnesses, prepared);
    commit(conn, &indexed, now_epoch_secs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::claude_code::test_support::fixture_home;
    use crate::harness::claude_code::{paths::ClaudeHome, slug, ClaudeCode};
    use rusqlite::Connection;
    use std::path::Path;

    fn boxed(home: &ClaudeHome) -> Vec<Box<dyn Harness>> {
        vec![Box::new(ClaudeCode::with_home(home.clone()))]
    }

    /// Registers `project` with the harness by writing the log directory the
    /// real thing would have left behind: `<home>/projects/<slug>/…jsonl`
    /// carrying the project as its `cwd`.
    fn register_project(home: &ClaudeHome, project: &Path) {
        let dir = home.projects_dir().join(slug::encode(project));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(
            dir.join("0001-session.jsonl"),
            format!(
                r#"{{"type":"other","cwd":"{}"}}"#,
                project.to_string_lossy()
            ),
        )
        .unwrap();
    }

    fn conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        conn
    }

    #[test]
    fn orchestrates_inventory_usage_and_reports_roots() {
        let (_g, home) = fixture_home();
        let conn = conn();
        let hs = boxed(&home);
        let out = run_harness_scan(&conn, &hs, 1_785_628_800).unwrap();
        assert_eq!(out.harness_count, 1);
        assert_eq!(out.project_count, 2);
        assert_eq!(out.roots, vec![home.root.join("work/app")]); // missing project excluded
        assert_eq!(out.extra_files, vec![home.global_rule()]);
        assert_eq!(out.skipped_lines, 1);
        // Six rollup rows — one per (kind, target) in the fixture's two
        // transcripts; matches `harness_store`'s own assertion on the same
        // fixture.
        let n: i64 = conn
            .query_row("SELECT count(*) FROM usage_stats", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 6);
        let det: i64 = conn
            .query_row(
                "SELECT detected FROM harnesses WHERE id='claude_code'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(det, 1);
    }

    /// A slug that resolves to the directory holding the harness home is the
    /// user's home wearing a project's clothes. Walking it would sweep the
    /// whole disk, so it is never a scan root — but the project row stays, so
    /// its sessions keep resolving.
    #[test]
    fn a_root_containing_the_harness_home_is_dropped_but_still_recorded() {
        let (_g, home) = fixture_home();
        register_project(&home, &home.root);
        let conn = conn();
        let out = run_harness_scan(&conn, &boxed(&home), 1_785_628_800).unwrap();

        assert!(!out.roots.contains(&home.root), "roots: {:?}", out.roots);
        assert_eq!(out.roots, vec![home.root.join("work/app")]);
        assert_eq!(out.project_count, 3, "every project is still recorded");
        let n: i64 = conn
            .query_row(
                "SELECT count(*) FROM harness_projects WHERE path = ?1",
                [home.root.to_string_lossy()],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 1);
    }

    /// `<project>/.claude == <harness home>`: the "project layer" would just be
    /// the global layer again, filed under a project path.
    #[test]
    fn a_project_that_owns_the_harness_home_gets_no_project_layer() {
        let tmp = tempfile::tempdir().unwrap();
        let user_home = tmp.path().canonicalize().unwrap();
        let root = user_home.join(".claude");
        std::fs::create_dir_all(root.join("projects")).unwrap();
        std::fs::write(root.join("CLAUDE.md"), "# global\n").unwrap();
        let home = ClaudeHome::at(root);
        register_project(&home, &user_home);

        let conn = conn();
        let out = run_harness_scan(&conn, &boxed(&home), 1_785_628_800).unwrap();

        assert_eq!(out.project_count, 1);
        assert!(out.roots.is_empty(), "roots: {:?}", out.roots);
        let n: i64 = conn
            .query_row(
                "SELECT count(*) FROM artifacts WHERE layer = 'project'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(n, 0);
    }

    /// End-to-end: a project reached through a symlink must still leave the
    /// file grader able to join `artifacts.file_id` back to `files.id` for its
    /// rule file. `fixture_home()` canonicalizes its tempdir root before
    /// anything is derived from it, so that fixture alone can never exercise
    /// the mismatch (its project paths are already canonical) — this test
    /// builds its own home with a project reachable only via a symlink, which
    /// is exactly the shape a real macOS run hits every time: `$TMPDIR` sits
    /// under `/var`, itself a symlink to `/private/var`.
    #[cfg(unix)]
    #[test]
    fn artifacts_for_a_symlinked_project_join_back_to_their_files_row() {
        let tmp = tempfile::tempdir().unwrap();
        let user_home = tmp.path().canonicalize().unwrap();
        let root = user_home.join(".claude");
        std::fs::create_dir_all(root.join("projects")).unwrap();
        std::fs::write(root.join("CLAUDE.md"), "# global\n").unwrap();
        let home = ClaudeHome::at(root);

        let real = user_home.join("real/app");
        std::fs::create_dir_all(&real).unwrap();
        std::fs::write(real.join("CLAUDE.md"), "# rules\n").unwrap();
        let link = user_home.join("link");
        std::os::unix::fs::symlink(&real, &link).unwrap();
        register_project(&home, &link);

        let conn = conn();
        let hs = boxed(&home);
        let out = run_harness_scan(&conn, &hs, 1_785_628_800).unwrap();
        assert_eq!(
            out.roots,
            vec![link.clone()],
            "root kept as the symlink path"
        );

        crate::scan::run_scan_all(&conn, &out.roots, &out.extra_files, |_, _| {}).unwrap();

        let dangling: i64 = conn
            .query_row(
                "SELECT count(*) FROM artifacts a
                 WHERE a.kind='rule' AND a.file_id IS NOT NULL
                   AND NOT EXISTS (SELECT 1 FROM files f WHERE f.id = a.file_id)",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            dangling, 0,
            "every rule artifact must join back to a files row"
        );

        let graded: i64 = conn
            .query_row(
                "SELECT count(*) FROM files WHERE id = ?1",
                [link.join("CLAUDE.md").to_string_lossy()],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(graded, 1, "the project's rule file was actually graded");
    }

    #[test]
    fn nested_roots_collapse_into_the_outermost_one() {
        let roots = vec![
            PathBuf::from("/work/app/sub"),
            PathBuf::from("/work/app"),
            PathBuf::from("/work/apple"),
        ];
        assert_eq!(
            scan_roots(roots, &[]),
            vec![PathBuf::from("/work/app"), PathBuf::from("/work/apple")]
        );
    }

    #[test]
    fn the_filesystem_root_is_never_a_scan_root() {
        assert!(scan_roots(vec![PathBuf::from("/")], &[]).is_empty());
    }

    #[test]
    fn the_users_home_is_never_a_scan_root() {
        let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
            return; // no HOME in this environment; nothing to assert
        };
        let kept = home.join("code/project");
        assert_eq!(scan_roots(vec![home, kept.clone()], &[]), vec![kept]);
    }

    #[test]
    fn diagnostics_are_reported_per_harness() {
        let (_g, home) = fixture_home();
        let out = run_harness_scan(&conn(), &boxed(&home), 1_785_628_800).unwrap();
        assert_eq!(
            out.skipped_lines_by_harness,
            vec![("claude_code".to_string(), 1)]
        );
        assert_eq!(out.skipped_lines, 1);
    }

    /// An existing project whose inventory comes back empty is far more likely
    /// unreadable than emptied, so the stored artifacts stay put.
    #[cfg(unix)]
    #[test]
    fn an_unreadable_project_keeps_the_artifacts_already_stored() {
        use std::os::unix::fs::PermissionsExt;
        let (_g, home) = fixture_home();
        let project = home.root.join("work/locked");
        std::fs::create_dir_all(project.join(".claude/skills/deploy")).unwrap();
        std::fs::write(project.join("CLAUDE.md"), "# locked\n").unwrap();
        std::fs::write(
            project.join(".claude/skills/deploy/SKILL.md"),
            "---\nname: deploy\n---\n",
        )
        .unwrap();
        register_project(&home, &project);

        let conn = conn();
        let first = run_harness_scan(&conn, &boxed(&home), 1_785_628_800).unwrap();
        assert_eq!(first.skipped_scopes, 0);
        let before = project_artifact_count(&conn, &project.to_string_lossy());
        assert!(before > 0, "the first pass should have stored something");

        let mode = std::fs::metadata(&project).unwrap().permissions().mode();
        std::fs::set_permissions(&project, std::fs::Permissions::from_mode(0o000)).unwrap();
        // Root (and a filesystem that ignores modes) reads straight through
        // 0o000; there is nothing to assert then.
        if std::fs::read_dir(&project).is_ok() {
            std::fs::set_permissions(&project, std::fs::Permissions::from_mode(mode)).unwrap();
            return;
        }
        let out = run_harness_scan(&conn, &boxed(&home), 1_785_628_801);
        std::fs::set_permissions(&project, std::fs::Permissions::from_mode(mode)).unwrap();

        let out = out.unwrap();
        assert_eq!(out.skipped_scopes, 1);
        assert_eq!(
            project_artifact_count(&conn, &project.to_string_lossy()),
            before,
            "an unreadable directory must not wipe the inventory"
        );
    }

    /// Two passes prepared from the same starting point: whichever commits
    /// second re-read bytes the first already stored, so its batch has to be
    /// dropped rather than merged on top.
    #[test]
    fn a_batch_prepared_before_another_pass_committed_is_dropped() {
        let (_g, home) = fixture_home();
        let conn = conn();
        let hs = boxed(&home);

        // Pass A: prepared and parsed, but held back.
        let a = index(&hs, prepare(&conn, &hs).unwrap());
        // Pass B: prepared from the same (empty) cursor, but committed first.
        let b = index(&hs, prepare(&conn, &hs).unwrap());
        let out_b = commit(&conn, &b, 1_785_628_800).unwrap();
        assert_eq!(out_b.stale_batches, 0);
        let turns = session_turns(&conn);
        assert!(turns > 0, "the first commit should have stored sessions");

        let out_a = commit(&conn, &a, 1_785_628_801).unwrap();
        assert_eq!(out_a.stale_batches, 1);
        assert_eq!(
            session_turns(&conn),
            turns,
            "a stale batch must not count its sessions twice"
        );
    }

    /// The project layer also lists the MCP servers declared in
    /// `~/.claude.json`, which keep showing up when the project directory
    /// itself cannot be read. They are not evidence that the walk worked.
    #[test]
    fn an_inventory_of_only_mcp_servers_does_not_wipe_a_project() {
        use crate::harness::model::{ArtifactKind, Layer};
        let (_g, home) = fixture_home();
        let conn = conn();
        let hs = boxed(&home);
        assert_eq!(
            run_harness_scan(&conn, &hs, 1_785_628_800)
                .unwrap()
                .skipped_scopes,
            0
        );
        let project = home.root.join("work/app").to_string_lossy().into_owned();
        let before = project_artifact_count(&conn, &project);
        assert!(before > 0, "the first pass should have stored something");

        let mcp = Artifact {
            harness: "claude_code".to_string(),
            layer: Layer::Project,
            project_path: Some(project.clone()),
            kind: ArtifactKind::McpServer,
            name: "linear".to_string(),
            path: home
                .root
                .join("user.claude.json")
                .to_string_lossy()
                .into_owned(),
            plugin_name: None,
            description: None,
            bytes: 0,
            hash: "h".to_string(),
        };
        let mut prepared = prepare(&conn, &hs).unwrap();
        prepared[0].project_inventories = vec![(project.clone(), vec![mcp])];
        let indexed: Vec<(PreparedHarness, UsageBatch)> = prepared
            .into_iter()
            .map(|p| (p, UsageBatch::default()))
            .collect();
        let out = commit(&conn, &indexed, 1_785_628_801).unwrap();

        assert_eq!(out.skipped_scopes, 1);
        assert_eq!(project_artifact_count(&conn, &project), before);
    }

    /// A folder the user picked by hand goes through the same sieve: `$HOME`
    /// is still too broad, and one nested in a root already listed is reached
    /// from that root.
    #[test]
    fn a_hand_picked_extra_folder_is_filtered_like_any_other_root() {
        let Some(home) = std::env::var_os("HOME").map(PathBuf::from) else {
            return; // no HOME in this environment; nothing to assert
        };
        let kept = home.join("code/project");
        let nested = kept.join("packages/ui");
        assert_eq!(
            scan_roots(vec![kept.clone(), home, nested], &[]),
            vec![kept]
        );
    }

    /// `~/shortcut -> ~/.claude` is the harness home under another name; the
    /// comparison has to see through the link.
    #[cfg(unix)]
    #[test]
    fn a_symlinked_root_is_resolved_before_it_is_judged() {
        let (_g, home) = fixture_home();
        let tmp = tempfile::tempdir().unwrap();
        let link = tmp.path().join("home-link");
        std::os::unix::fs::symlink(&home.root, &link).unwrap();
        assert!(
            scan_roots(vec![link], std::slice::from_ref(&home.root)).is_empty(),
            "a symlink to the harness home is still the harness home"
        );
    }

    /// A project reached through a symlink is judged (for the home/ancestor
    /// checks) by what the link resolves to, but it must survive as a kept
    /// root — and come back out as the SYMLINK path, not the resolved one:
    /// `artifacts.file_id` for that project's rule files is built from the
    /// same non-canonicalized path, and the walker has to be pointed at it so
    /// the files it stores carry matching ids.
    #[cfg(unix)]
    #[test]
    fn a_symlinked_project_root_is_kept_and_returned_as_the_symlink_path() {
        let tmp = tempfile::tempdir().unwrap();
        let real = tmp.path().join("real/app");
        std::fs::create_dir_all(&real).unwrap();
        let link = tmp.path().join("link");
        std::os::unix::fs::symlink(&real, &link).unwrap();

        assert_eq!(scan_roots(vec![link.clone()], &[]), vec![link]);
    }

    fn session_turns(conn: &Connection) -> i64 {
        conn.query_row("SELECT coalesce(sum(turns), 0) FROM sessions", [], |r| {
            r.get(0)
        })
        .unwrap()
    }

    fn project_artifact_count(conn: &Connection, path: &str) -> i64 {
        conn.query_row(
            "SELECT count(*) FROM artifacts WHERE layer = 'project' AND project_path = ?1",
            [path],
            |r| r.get(0),
        )
        .unwrap()
    }
}
