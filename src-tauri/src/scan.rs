//! Scan orchestration: walk → grade → persist.

use std::collections::{HashMap, HashSet};
use std::path::Path;

use rusqlite::{params, Connection};
use sha2::{Digest, Sha256};

use crate::engine::{
    evaluate_ctx, grade_for_score, score_for_counts, Fix, Grade, Issue, RuleContext, Severity,
};
use crate::query::{severity_from_db, source_from_db};
use crate::repo_root::{find_repo_root, resolution_root};
use crate::scanner;

/// A stable content fingerprint used to detect whether a file changed since
/// its NL-standards issues were last recorded (#85). Not a security
/// primitive — just a cheap, collision-resistant-enough change detector.
fn content_hash(content: &str) -> String {
    let digest = Sha256::digest(content.as_bytes());
    digest.iter().map(|b| format!("{b:02x}")).collect()
}

/// Every NL-sourced issue currently persisted for a file, keyed by file id
/// (path), plus each file's last-recorded content hash. Snapshotted before
/// the full-rescan wipe so unchanged files can carry their AI-standards
/// verdicts forward instead of losing them (#85).
struct PriorNlState {
    hashes: HashMap<String, String>,
    issues: HashMap<String, Vec<Issue>>,
}

fn snapshot_prior_nl_state(conn: &Connection) -> rusqlite::Result<PriorNlState> {
    let mut hashes = HashMap::new();
    {
        let mut stmt =
            conn.prepare("SELECT id, content_hash FROM files WHERE content_hash IS NOT NULL")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        for row in rows {
            let (id, hash) = row?;
            hashes.insert(id, hash);
        }
    }

    // Rules that are still enabled and still exist — a rescan must not carry
    // forward an issue for a rule the user has since disabled or deleted
    // (#94 P0). `enabled_nl_rules(.., true)` already applies the same
    // enabled/exists filtering `query::evaluate_nl_rules` uses for a fresh
    // check, so carry-forward and a fresh check agree on what counts.
    let active_nl_ids: HashSet<String> = crate::query::enabled_nl_rules(conn, true)?
        .into_iter()
        .map(|r| r.id)
        .collect();

    let mut issues: HashMap<String, Vec<Issue>> = HashMap::new();
    {
        let mut stmt = conn.prepare(
            "SELECT file_id, rule_id, line, severity, source, title, why, fix_from, fix_to, dimension
             FROM issues WHERE rule_id IS NOT NULL",
        )?;
        let rows = stmt.query_map([], |r| {
            let file_id: String = r.get(0)?;
            let rule_id: String = r.get(1)?;
            let line: Option<i64> = r.get(2)?;
            let severity: String = r.get(3)?;
            let source: String = r.get(4)?;
            let title: String = r.get(5)?;
            let why: String = r.get(6)?;
            let fix_from: Option<String> = r.get(7)?;
            let fix_to: Option<String> = r.get(8)?;
            let dimension: Option<String> = r.get(9)?;
            Ok((
                file_id, rule_id, line, severity, source, title, why, fix_from, fix_to, dimension,
            ))
        })?;
        for row in rows {
            let (file_id, rule_id, line, severity, source, title, why, fix_from, fix_to, dimension) =
                row?;
            if !active_nl_ids.contains(&rule_id) {
                // Rule has since been disabled or deleted — drop the stale
                // carry-forward instead of folding it into the score again.
                continue;
            }
            let fix = match (fix_from, fix_to) {
                (Some(from), Some(to)) => Some(Fix { from, to }),
                _ => None,
            };
            issues.entry(file_id).or_default().push(Issue {
                rule_id,
                severity: severity_from_db(&severity),
                source: source_from_db(&source),
                title,
                why,
                line: line.map(|l| l as u32),
                fix,
                dimension: crate::engine::Dimension::from_db(&dimension.unwrap_or_default()),
            });
        }
    }

    Ok(PriorNlState { hashes, issues })
}

/// Per-scan memo of repo-root / resolution-root lookups, keyed by the
/// file's parent directory. Every file scan does a handful of `stat` calls
/// to find its roots; a project with many prompt files in the same
/// directory (or the same monorepo package) would otherwise redo that walk
/// once per file.
#[derive(Default)]
struct RootCache {
    repo_root: HashMap<std::path::PathBuf, Option<std::path::PathBuf>>,
    resolution_root: HashMap<std::path::PathBuf, Option<std::path::PathBuf>>,
}

impl RootCache {
    fn repo_root_for(&mut self, file_path: &Path) -> Option<std::path::PathBuf> {
        let parent = file_path.parent()?;
        self.repo_root
            .entry(parent.to_path_buf())
            .or_insert_with(|| find_repo_root(file_path))
            .clone()
    }

    fn resolution_root_for(&mut self, file_path: &Path) -> Option<std::path::PathBuf> {
        let parent = file_path.parent()?;
        self.resolution_root
            .entry(parent.to_path_buf())
            .or_insert_with(|| resolution_root(file_path))
            .clone()
    }
}

/// Summary of a completed scan, returned to the frontend.
#[derive(Debug, Clone, serde::Serialize, specta::Type)]
pub struct ScanSummary {
    pub files_scanned: u32,
    pub projects: u32,
    pub critical: u32,
    pub warnings: u32,
    pub nits: u32,
    pub overall_score: u32,
    pub overall_grade: Grade,
}

/// Seconds-since-epoch timestamp string, used for every `recorded_at` /
/// `started_at` column. Shared with `query::apply_nl_verdicts`, which writes
/// to the same `grade_history` table.
pub(crate) fn now_epoch() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

/// Drop a trailing path separator from a directory path.
///
/// `git2` reports a worktree root *with* one (`/code/app/`), while every
/// other place a project directory is recorded — `harness_projects.path`,
/// `artifacts.project_path`, `sessions.project_path` — has none. Leaving the
/// separator on `projects.id` makes all of those joins miss silently, so it
/// is stripped at the single point the id is minted. The filesystem root
/// (`/`) keeps its separator: there it is the whole path.
fn trim_trailing_separator(path: &str) -> &str {
    let trimmed = path.trim_end_matches(std::path::MAIN_SEPARATOR);
    if trimmed.is_empty() {
        path
    } else {
        trimmed
    }
}

/// Resolve the project that owns `path`: `(id, name, root_path)`.
///
/// The project root is the git worktree root (or nearest manifest) from
/// `find_repo_root`; a loose file with no root falls back to its parent
/// folder, so every file maps to a project. `id` is the absolute root path
/// with no trailing separator (unique — two same-named repos stay distinct,
/// and it joins against the harness tables); `name` is the root's final path
/// component.
fn resolve_project(path: &Path, roots: &mut RootCache) -> (String, String, String) {
    let root = roots
        .repo_root_for(path)
        .unwrap_or_else(|| path.parent().map(|p| p.to_path_buf()).unwrap_or_default());
    let name = root
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "root".to_string());
    let root_path = trim_trailing_separator(&root.display().to_string()).to_string();
    (root_path.clone(), name, root_path)
}

/// Walk `root`, grade every prompt file, and persist the results. Calls
/// `on_progress(done, total)` after each file. Returns a summary.
///
/// Thin wrapper over [`run_scan_all`] for the single-root case. Now that the
/// app always scans every harness root at once, only the tests take this
/// path.
#[cfg(test)]
pub fn run_scan(
    conn: &Connection,
    root: &Path,
    on_progress: impl FnMut(u32, u32),
) -> rusqlite::Result<ScanSummary> {
    run_scan_all(conn, &[root.to_path_buf()], &[], on_progress)
}

/// The summary a no-op scan reports: what is already persisted, with
/// `files_scanned = 0`. A `scans` row is still written — the scan did happen,
/// it just had nothing to walk — so the scheduler's "when did we last scan"
/// clock keeps ticking instead of re-firing every tick.
fn summarize_existing(conn: &Connection) -> rusqlite::Result<ScanSummary> {
    let count_sev = |sev: &str| -> rusqlite::Result<u32> {
        conn.query_row(
            "SELECT COUNT(*) FROM issues WHERE severity = ?1",
            [sev],
            |r| r.get::<_, i64>(0),
        )
        .map(|n| n as u32)
    };
    let projects =
        conn.query_row("SELECT COUNT(*) FROM projects", [], |r| r.get::<_, i64>(0))? as u32;
    let overall_score = conn
        .query_row("SELECT AVG(score) FROM files", [], |r| {
            r.get::<_, Option<f64>>(0)
        })?
        .map(|avg| avg as u32)
        .unwrap_or(100);

    conn.execute(
        "INSERT INTO scans(started_at, finished_at, files_scanned) VALUES(?1, ?1, 0)",
        params![now_epoch()],
    )?;

    Ok(ScanSummary {
        files_scanned: 0,
        projects,
        critical: count_sev("hi")?,
        warnings: count_sev("mid")?,
        nits: count_sev("lo")?,
        overall_score,
        overall_grade: grade_for_score(overall_score),
    })
}

/// Walk every root in `roots`, add the explicitly named `extra_files` (a
/// harness's global rule file, say), grade the union, and persist the
/// results. Calls `on_progress(done, total)` after each file.
///
/// Roots may overlap (a project nested inside a manual folder), so the file
/// list is de-duplicated by path before grading — one row per file, whichever
/// root found it.
pub fn run_scan_all(
    conn: &Connection,
    roots: &[std::path::PathBuf],
    extra_files: &[std::path::PathBuf],
    mut on_progress: impl FnMut(u32, u32),
) -> rusqlite::Result<ScanSummary> {
    // Nothing to walk — no harness detected and no extra folders. Grading an
    // empty file list would wipe every prior result, turning a first launch
    // before detection (or a temporarily unreadable home) into "you have no
    // prompts". Record the scan so the scheduler keeps its cadence, but leave
    // `files`/`issues`/`projects` exactly as they are.
    if roots.is_empty() && extra_files.is_empty() {
        return summarize_existing(conn);
    }

    let mut files: Vec<scanner::PromptFile> =
        roots.iter().flat_map(|r| scanner::scan_folder(r)).collect();
    files.extend(scanner::scan_files(extra_files));
    files.sort_by(|a, b| a.path.cmp(&b.path));
    files.dedup_by(|a, b| a.path == b.path);
    let total = files.len() as u32;
    let rules = crate::query::active_rules(conn);
    let now = now_epoch();

    // Snapshot NL-sourced issues + content hashes before the wipe below, so a
    // file whose content is unchanged can carry its AI-standards verdicts
    // forward (#85) instead of losing them on every rescan.
    let prior = snapshot_prior_nl_state(conn)?;

    // Full rescan: clear prior results (grade history is kept).
    conn.execute_batch("DELETE FROM issues; DELETE FROM files; DELETE FROM projects;")?;

    let mut project_scores: HashMap<String, Vec<u32>> = HashMap::new();
    let (mut critical, mut warnings, mut nits) = (0u32, 0u32, 0u32);
    let mut root_cache = RootCache::default();

    for (i, file) in files.iter().enumerate() {
        let file_path = Path::new(&file.path);
        let repo_root = root_cache.repo_root_for(file_path);
        let resolution_root = root_cache.resolution_root_for(file_path);
        let ctx = RuleContext {
            content: &file.content,
            file_path: Some(file_path),
            repo_root: repo_root.as_deref(),
            resolution_root: resolution_root.as_deref(),
            modified_unix: file.modified_unix,
        };
        let mut issues = evaluate_ctx(&ctx, &rules).issues;
        issues.extend(crate::query::custom_issues(conn, &file.content));

        // Content-hash comparison: only an unchanged file carries its prior
        // NL-standards issues forward. A changed (or brand-new) file starts
        // with a clean AI-standards slate — stale AI judgments must not
        // survive edits.
        let hash = content_hash(&file.content);
        let carried_nl: Vec<Issue> = match prior.hashes.get(&file.path) {
            Some(prev_hash) if prev_hash == &hash => {
                prior.issues.get(&file.path).cloned().unwrap_or_default()
            }
            _ => Vec::new(),
        };

        let (mut hi, mut mid, mut lo) = (0u32, 0u32, 0u32);
        for issue in issues.iter().chain(carried_nl.iter()) {
            match issue.severity {
                Severity::Hi => hi += 1,
                Severity::Mid => mid += 1,
                Severity::Lo => lo += 1,
            }
        }
        let score = score_for_counts(hi, mid, lo);
        let grade = grade_for_score(score);
        let (project_id, project_name, project_root) = resolve_project(file_path, &mut root_cache);
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
        for issue in &issues {
            // `rule_id` is what ties a finding back to the rule that raised it
            // — the Rules screen's hit counts read it, and dismissing a
            // finding has to stop counting for that rule.
            conn.execute(
                "INSERT INTO issues(file_id, rule_id, line, severity, source, title, why, fix_from, fix_to, dimension)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    file.path,
                    issue.rule_id,
                    issue.line.map(|l| l as i64),
                    issue.severity.as_str(),
                    issue.source.as_str(),
                    issue.title,
                    issue.why,
                    issue.fix.as_ref().map(|f| f.from.as_str()),
                    issue.fix.as_ref().map(|f| f.to.as_str()),
                    issue.dimension.as_str(),
                ],
            )?;
        }
        for issue in &carried_nl {
            conn.execute(
                "INSERT INTO issues(file_id, rule_id, line, severity, source, title, why, fix_from, fix_to, dimension)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    file.path,
                    issue.rule_id,
                    issue.line.map(|l| l as i64),
                    issue.severity.as_str(),
                    issue.source.as_str(),
                    issue.title,
                    issue.why,
                    issue.fix.as_ref().map(|f| f.from.as_str()),
                    issue.fix.as_ref().map(|f| f.to.as_str()),
                    issue.dimension.as_str(),
                ],
            )?;
        }
        critical += hi;
        warnings += mid;
        nits += lo;
        conn.execute(
            "INSERT INTO grade_history(scope, scope_id, score, recorded_at) VALUES('file', ?1, ?2, ?3)",
            params![file.path, score as i64, now],
        )?;
        project_scores.entry(project_id).or_default().push(score);
        on_progress(i as u32 + 1, total);
    }

    // Roll up project + overall scores.
    let mut all_scores: Vec<u32> = Vec::new();
    for (project, scores) in &project_scores {
        let avg = scores.iter().sum::<u32>() / scores.len() as u32;
        let grade = grade_for_score(avg);
        conn.execute(
            "UPDATE projects SET score = ?1, grade = ?2 WHERE id = ?3",
            params![avg as i64, grade.letter(), project.as_str()],
        )?;
        all_scores.extend(scores.iter().copied());
    }
    let overall_score = if all_scores.is_empty() {
        100
    } else {
        all_scores.iter().sum::<u32>() / all_scores.len() as u32
    };
    let overall_grade = grade_for_score(overall_score);

    conn.execute(
        "INSERT INTO grade_history(scope, scope_id, score, recorded_at) VALUES('overall', 'overall', ?1, ?2)",
        params![overall_score as i64, now],
    )?;
    conn.execute(
        "INSERT INTO scans(started_at, finished_at, files_scanned) VALUES(?1, ?1, ?2)",
        params![now, total as i64],
    )?;

    Ok(ScanSummary {
        files_scanned: total,
        projects: project_scores.len() as u32,
        critical,
        warnings,
        nits,
        overall_score,
        overall_grade,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    // #74 narrowed the model rule to clearly-deprecated ids only, so this
    // fixture names a retired model (claude-2) to keep the 5-issue count.
    const FOCAL: &str = "\
# API Worker assistant

You are an assistant.
Always use claude-2 for completions.
Be concise but also very thorough and detailed.

[no examples provided]
";

    const CLEAN: &str = "\
You are a senior Rust reviewer for the service.
Focus on correctness, idiomatic ownership, and clear error handling.
Respond in JSON.
For example:
```
{}
```
";

    #[test]
    fn run_scan_persists_graded_files() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();

        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("api-worker")).unwrap();
        fs::write(dir.path().join("api-worker/CLAUDE.md"), FOCAL).unwrap();
        fs::create_dir_all(dir.path().join("web-app")).unwrap();
        fs::write(dir.path().join("web-app/AGENTS.md"), CLEAN).unwrap();

        let summary = run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        assert_eq!(summary.files_scanned, 2);
        assert_eq!(summary.projects, 2);

        let files: i64 = conn
            .query_row("SELECT COUNT(*) FROM files", [], |r| r.get(0))
            .unwrap();
        assert_eq!(files, 2);

        let focal_grade: String = conn
            .query_row(
                "SELECT f.grade FROM files f JOIN projects p ON p.id = f.project_id
                 WHERE p.name = 'api-worker'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(focal_grade, "D");

        let focal_issues: i64 = conn
            .query_row(
                "SELECT f.issue_count FROM files f JOIN projects p ON p.id = f.project_id
                 WHERE p.name = 'api-worker'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(focal_issues, 5);

        let clean_grade: String = conn
            .query_row(
                "SELECT f.grade FROM files f JOIN projects p ON p.id = f.project_id
                 WHERE p.name = 'web-app'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(clean_grade, "A");

        // 2 file-scope + 1 overall history rows.
        let history: i64 = conn
            .query_row("SELECT COUNT(*) FROM grade_history", [], |r| r.get(0))
            .unwrap();
        assert_eq!(history, 3);
    }

    #[test]
    fn persisted_issue_carries_the_rules_dimension() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();

        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("CLAUDE.md"), FOCAL).unwrap();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        // The FOCAL fixture's deprecated-model ("claude-2") issue is tagged
        // Consistency in the rule→dimension mapping.
        let dimension: String = conn
            .query_row(
                "SELECT dimension FROM issues WHERE title = 'Deprecated model name'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(dimension, "Consistency");

        // Every persisted issue for this scan must have a non-null dimension.
        let missing: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM issues WHERE dimension IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(missing, 0);
    }

    #[test]
    fn progress_is_reported() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("CLAUDE.md"), FOCAL).unwrap();

        let mut last = (0u32, 0u32);
        run_scan(&conn, dir.path(), |done, total| last = (done, total)).unwrap();
        assert_eq!(last, (1, 1));
    }

    fn clarity_verdict(violates: bool) -> crate::ai_rules::NlVerdict {
        crate::ai_rules::NlVerdict {
            rule_id: "anthropic-clarity".into(),
            title: "Vague directives".into(),
            severity: "mid".into(),
            source: "anthropic".into(),
            violates,
            explanation: "Too vague.".into(),
        }
    }

    #[test]
    fn rescan_preserves_nl_issues_when_content_unchanged() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");
        fs::write(&file, CLEAN).unwrap();
        let file_id = file.display().to_string();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let (baseline_score, baseline_issues): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();

        let verdicts = vec![clarity_verdict(true)];
        let (nl_score, _) = crate::query::apply_nl_verdicts(&conn, &file_id, &verdicts).unwrap();
        assert!(
            (nl_score as i64) < baseline_score,
            "an NL violation must lower the score"
        );

        // Rescan the same, unchanged content — the NL issue must survive and
        // the score must reflect the union of deterministic + NL issues, not
        // revert to the deterministic-only baseline.
        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let (score, issue_count): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(
            score, nl_score as i64,
            "score must carry the NL issue forward across an unchanged rescan"
        );
        assert_eq!(issue_count, baseline_issues + 1);

        let rule_id: Option<String> = conn
            .query_row(
                "SELECT rule_id FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(rule_id.as_deref(), Some("anthropic-clarity"));
    }

    #[test]
    fn rescan_drops_nl_issues_when_content_changed() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");
        fs::write(&file, CLEAN).unwrap();
        let file_id = file.display().to_string();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let verdicts = vec![clarity_verdict(true)];
        crate::query::apply_nl_verdicts(&conn, &file_id, &verdicts).unwrap();

        let nl_issues_before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(nl_issues_before, 1);

        // Edit the file — the content hash changes, so the stale AI judgment
        // must not survive.
        fs::write(
            &file,
            format!("{CLEAN}\nOne more sentence changes the hash.\n"),
        )
        .unwrap();
        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let nl_issues_after: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(
            nl_issues_after, 0,
            "an NL issue must not survive a content change"
        );
    }

    #[test]
    fn rescan_drops_nl_issue_when_rule_disabled() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        crate::query::seed_builtin_nl_rules(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");
        fs::write(&file, CLEAN).unwrap();
        let file_id = file.display().to_string();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let (baseline_score, baseline_issues): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();

        let verdicts = vec![clarity_verdict(true)];
        crate::query::apply_nl_verdicts(&conn, &file_id, &verdicts).unwrap();

        // Disable the rule that produced the carried issue — mirrors a user
        // toggling a standard off between scans.
        crate::query::set_rule(&conn, "anthropic-clarity", false).unwrap();

        // Rescan unchanged content — the disabled rule's issue must not
        // survive, and the score must match what a fresh check (which
        // already filters by rule state) would produce.
        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let (score, issue_count): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(
            score, baseline_score,
            "a disabled rule's carried issue must not depress the score"
        );
        assert_eq!(issue_count, baseline_issues);

        let nl_issue_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM issues WHERE file_id = ?1 AND rule_id IS NOT NULL",
                [&file_id],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(nl_issue_count, 0);
    }

    #[test]
    fn rescan_drops_nl_issue_when_custom_rule_deleted() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        crate::query::seed_builtin_nl_rules(&conn).unwrap();
        let rule_id =
            crate::query::add_nl_rule(&conn, "No Slack", "VIOLATES if it mentions Slack.", "mid")
                .unwrap();

        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("CLAUDE.md");
        fs::write(&file, CLEAN).unwrap();
        let file_id = file.display().to_string();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        let (baseline_score, baseline_issues): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();

        let verdict = crate::ai_rules::NlVerdict {
            rule_id: rule_id.clone(),
            title: "No Slack".into(),
            severity: "mid".into(),
            source: "custom".into(),
            violates: true,
            explanation: "Mentions Slack.".into(),
        };
        crate::query::apply_nl_verdicts(&conn, &file_id, &[verdict]).unwrap();

        // Delete the custom rule entirely — mirrors a user removing an AI
        // rule between scans.
        crate::query::delete_custom_rule(&conn, &rule_id).unwrap();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let (score, issue_count): (i64, i64) = conn
            .query_row(
                "SELECT score, issue_count FROM files WHERE id = ?1",
                [&file_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(
            score, baseline_score,
            "a deleted custom rule's carried issue must not depress the score"
        );
        assert_eq!(issue_count, baseline_issues);
    }

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
        let repo_name = dir
            .path()
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned();
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

    #[test]
    fn project_id_is_slash_free_so_the_harness_row_joins() {
        // git2 reports a worktree root with a trailing separator. If that
        // reaches `projects.id`, every join against a harness-recorded path
        // (which has none) silently misses — the bug this guards.
        let conn = crate::store::test_conn();
        let dir = tempfile::tempdir().unwrap();
        git2::Repository::init(dir.path()).unwrap();
        fs::write(dir.path().join("CLAUDE.md"), CLEAN).unwrap();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let id: String = conn
            .query_row("SELECT id FROM projects", [], |r| r.get(0))
            .unwrap();
        assert!(
            !id.ends_with(std::path::MAIN_SEPARATOR),
            "project id must not carry the worktree's trailing separator: {id}"
        );

        // Seeded the way a harness scan records it: no trailing separator.
        let harness_path = id.trim_end_matches(std::path::MAIN_SEPARATOR).to_string();
        conn.execute(
            "INSERT INTO harness_projects(harness, path, exists_on_disk, last_session_at, session_count)
             VALUES('claude_code', ?1, 1, '2026-08-01T10:00:00Z', 3)",
            params![harness_path],
        )
        .unwrap();

        let projects = crate::query::list_projects(&conn).unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].harness.as_deref(), Some("claude_code"));
        assert_eq!(projects[0].session_count, 3);
        assert!(projects[0].exists);
    }

    #[test]
    fn deterministic_issues_carry_their_rule_id() {
        let conn = crate::store::test_conn();
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("CLAUDE.md"), FOCAL).unwrap();

        run_scan(&conn, dir.path(), |_, _| {}).unwrap();

        let hits = |conn: &Connection| {
            crate::query::list_rules(conn)
                .unwrap()
                .into_iter()
                .find(|r| r.id == "no-hardcoded-model")
                .expect("the deprecated-model rule is in the catalog")
                .hit_count
        };
        assert_eq!(
            hits(&conn),
            1,
            "a deterministic hit must count for its rule"
        );

        conn.execute(
            "UPDATE issues SET dismissed_at = '1' WHERE rule_id = 'no-hardcoded-model'",
            [],
        )
        .unwrap();
        assert_eq!(hits(&conn), 0, "a dismissed finding stops counting");
    }

    #[test]
    fn run_scan_all_covers_multiple_roots_and_extra_files() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        let g = tempfile::tempdir().unwrap();
        fs::write(a.path().join("CLAUDE.md"), FOCAL).unwrap();
        fs::write(b.path().join("AGENTS.md"), CLEAN).unwrap();
        fs::write(g.path().join("CLAUDE.md"), CLEAN).unwrap();
        let summary = run_scan_all(
            &conn,
            &[a.path().to_path_buf(), b.path().to_path_buf()],
            &[g.path().join("CLAUDE.md")],
            |_, _| {},
        )
        .unwrap();
        assert_eq!(summary.files_scanned, 3);
        assert_eq!(summary.projects, 3);
    }

    #[test]
    fn empty_root_set_keeps_prior_results() {
        let conn = Connection::open_in_memory().unwrap();
        crate::store::migrate(&conn).unwrap();
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("CLAUDE.md"), FOCAL).unwrap();
        let seeded = run_scan(&conn, dir.path(), |_, _| {}).unwrap();
        assert_eq!(seeded.files_scanned, 1);

        // No harness detected and no extra folders: nothing to walk. The last
        // good grades must survive rather than being wiped to an empty app.
        let summary = run_scan_all(&conn, &[], &[], |_, _| {}).unwrap();
        assert_eq!(summary.files_scanned, 0);
        assert_eq!(summary.projects, 1);
        assert_eq!(summary.critical, seeded.critical);
        assert_eq!(summary.warnings, seeded.warnings);
        assert_eq!(summary.nits, seeded.nits);
        assert_eq!(summary.overall_score, seeded.overall_score);

        let files: i64 = conn
            .query_row("SELECT count(*) FROM files", [], |r| r.get(0))
            .unwrap();
        assert_eq!(files, 1, "an empty root set must not wipe the graded files");
        let issues: i64 = conn
            .query_row("SELECT count(*) FROM issues", [], |r| r.get(0))
            .unwrap();
        assert!(issues > 0);
        let projects: i64 = conn
            .query_row("SELECT count(*) FROM projects", [], |r| r.get(0))
            .unwrap();
        assert_eq!(projects, 1);
        // The scan still counts as a scan, so the scheduler does not spin.
        let scans: i64 = conn
            .query_row("SELECT count(*) FROM scans", [], |r| r.get(0))
            .unwrap();
        assert_eq!(scans, 2);
    }
}
