//! Incremental indexer for `~/.claude/projects/<slug>/*.jsonl`.
//!
//! Logs are append-only and can be huge, so a file is never read whole: each
//! pass streams from the byte offset the last pass stopped at and stops at the
//! last complete line, leaving a half-written tail for the next round.

use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Seek, SeekFrom};
use std::path::Path;

use super::classify::classify;
use super::inventory::HARNESS_ID;
use super::log_records::{parse_line, LogRecord};
use super::paths::ClaudeHome;
use super::slug;
use crate::harness::model::{Invocation, OrphanResult, SessionMeta, UsageBatch, UsageCursor};

/// One pass over one log file.
///
/// On a resumed read (`from_offset > 0`) everything derived from records —
/// `session.started_at`, `ended_at`, `model` and `project_path` — describes
/// only the newly read range, not the whole session. The store must merge:
/// `MIN` for `started_at`, `MAX` for `ended_at`, `COALESCE` for `model` and
/// `project_path` so a range without `cwd` cannot overwrite a real one.
#[derive(Debug)]
pub struct IndexedFile {
    pub session: SessionMeta,
    pub invocations: Vec<Invocation>,
    /// `tool_result`s whose `tool_use` was indexed in an earlier pass.
    pub orphan_results: Vec<OrphanResult>,
    pub skipped_lines: u64,
    pub new_offset: u64,
    /// The file was shorter than the cursor (truncated or rotated), so it was
    /// re-read from 0 — the store must wipe this session's prior rows first.
    pub reset: bool,
}

/// `YYYY-MM-DDTHH:MM:SS(.mmm)Z` → milliseconds since epoch. No tz offsets
/// (Claude Code always writes UTC `Z`).
pub(super) fn epoch_ms(ts: &str) -> Option<i64> {
    let ts = ts.strip_suffix('Z')?;
    let (date, time) = ts.split_once('T')?;
    let mut d = date.split('-').map(|x| x.parse::<i64>());
    let (y, m, day) = (d.next()?.ok()?, d.next()?.ok()?, d.next()?.ok()?);
    let (hms, ms) = time.split_once('.').unwrap_or((time, "0"));
    let mut t = hms.split(':').map(|x| x.parse::<i64>());
    let (h, mi, s) = (t.next()?.ok()?, t.next()?.ok()?, t.next()?.ok()?);
    // Char-based so a non-ASCII millis field can never split a byte boundary.
    let ms: i64 = ms
        .chars()
        .chain(std::iter::repeat('0'))
        .take(3)
        .try_fold(0i64, |a, c| Some(a * 10 + c.to_digit(10)? as i64))?;
    // The crate builds with `panic = "abort"`, so out-of-range fields must be
    // rejected rather than allowed to overflow the arithmetic below.
    if !(1..=9999).contains(&y)
        || !(1..=12).contains(&m)
        || !(1..=31).contains(&day)
        || !(0..=23).contains(&h)
        || !(0..=59).contains(&mi)
        || !(0..=60).contains(&s)
    {
        return None;
    }
    // Days from civil (Howard Hinnant's algorithm).
    let (y2, m2) = if m <= 2 { (y - 1, m + 9) } else { (y, m - 3) };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let doy = (153 * m2 + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some((((days * 24 + h) * 60 + mi) * 60 + s) * 1000 + ms)
}

struct Pending {
    inv: Invocation,
    use_ms: Option<i64>,
}

/// Reads `log_path` from `from_offset` to the last complete line.
/// `fallback_project` stands in when no record in the range carries a `cwd`.
pub fn index_file(
    log_path: &Path,
    from_offset: u64,
    fallback_project: &str,
) -> std::io::Result<IndexedFile> {
    let mut file = File::open(log_path)?;
    let len = file.metadata()?.len();
    let reset = from_offset > len;
    let start = if reset { 0 } else { from_offset };
    file.seek(SeekFrom::Start(start))?;
    let mut reader = BufReader::with_capacity(256 * 1024, file);

    let session_id = log_path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let mut session = SessionMeta {
        harness: HARNESS_ID.into(),
        id: session_id.clone(),
        log_path: log_path.to_string_lossy().into_owned(),
        ..Default::default()
    };
    let mut pending: HashMap<String, Pending> = HashMap::new();
    let mut order: Vec<String> = Vec::new();
    let mut orphan_results: Vec<OrphanResult> = Vec::new();
    let mut skipped = 0u64;
    let mut offset = start;
    let mut buf: Vec<u8> = Vec::new();

    loop {
        buf.clear();
        // Bytes, not `read_line`: one invalid-UTF-8 line must not error out and
        // strand the cursor on this file forever.
        let n = reader.read_until(b'\n', &mut buf)?;
        if n == 0 {
            break;
        }
        if !buf.ends_with(b"\n") {
            break; // partial trailing line: leave it for the next run
        }
        offset += n as u64;
        let line = String::from_utf8_lossy(&buf);
        if line.trim().is_empty() {
            continue;
        }
        let Some(rec) = parse_line(&line) else {
            skipped += 1;
            continue;
        };
        let (ts, cwd) = match &rec {
            LogRecord::Assistant { ts, cwd, .. } | LogRecord::ToolResults { ts, cwd, .. } => {
                (Some(ts.clone()), cwd.clone())
            }
            LogRecord::Other { ts, cwd } => (ts.clone(), cwd.clone()),
        };
        if session.project_path.is_empty() {
            if let Some(c) = cwd {
                session.project_path = c;
            }
        }
        if let Some(ts) = ts.filter(|t| !t.is_empty()) {
            if session.started_at.is_none() {
                session.started_at = Some(ts.clone());
            }
            session.ended_at = Some(ts);
        }
        match rec {
            LogRecord::Assistant {
                ts,
                model,
                input_tokens,
                output_tokens,
                tool_uses,
                ..
            } => {
                session.turns += 1;
                session.input_tokens += input_tokens;
                session.output_tokens += output_tokens;
                if session.model.is_none() {
                    session.model = model;
                }
                for tu in tool_uses {
                    let (kind, target) = classify(&tu.name, &tu.input);
                    let inv = Invocation {
                        harness: HARNESS_ID.into(),
                        session_id: session_id.clone(),
                        tool_use_id: tu.id.clone(),
                        project_path: String::new(),
                        ts: ts.clone(),
                        tool_name: tu.name,
                        kind,
                        target,
                        duration_ms: None,
                        is_error: false,
                        turn_tokens: Some(input_tokens + output_tokens),
                    };
                    order.push(tu.id.clone());
                    pending.insert(
                        tu.id,
                        Pending {
                            use_ms: epoch_ms(&ts),
                            inv,
                        },
                    );
                }
            }
            LogRecord::ToolResults { ts, results, .. } => {
                let end = epoch_ms(&ts);
                for r in results {
                    if let Some(p) = pending.get_mut(&r.tool_use_id) {
                        p.inv.is_error = r.is_error;
                        p.inv.duration_ms = match (p.use_ms, end) {
                            (Some(a), Some(b)) => Some(b - a),
                            _ => None,
                        };
                    } else if let Some(end_ms) = end {
                        // Its `tool_use` was indexed in an earlier pass.
                        orphan_results.push(OrphanResult {
                            harness: HARNESS_ID.into(),
                            session_id: session_id.clone(),
                            tool_use_id: r.tool_use_id,
                            end_ms,
                            is_error: r.is_error,
                        });
                    }
                }
            }
            LogRecord::Other { .. } => {}
        }
    }

    if session.project_path.is_empty() {
        session.project_path = fallback_project.to_string();
    }
    let project = session.project_path.clone();
    let invocations = order
        .into_iter()
        .filter_map(|id| pending.remove(&id))
        .map(|mut p| {
            p.inv.project_path = project.clone();
            p.inv
        })
        .collect();
    Ok(IndexedFile {
        session,
        invocations,
        orphan_results,
        skipped_lines: skipped,
        new_offset: offset,
        reset,
    })
}

/// Indexes every `projects/*/*.jsonl` from where `cursor` left off, advancing
/// it in place. Unreadable files are skipped rather than failing the sweep.
pub fn index_all(home: &ClaudeHome, cursor: &mut UsageCursor) -> UsageBatch {
    let mut batch = UsageBatch::default();
    let Ok(dirs) = std::fs::read_dir(home.projects_dir()) else {
        return batch;
    };
    // `projects/` also holds junk like `.DS_Store`; only slug dirs matter.
    let mut dirs: Vec<_> = dirs.flatten().filter(|d| d.path().is_dir()).collect();
    dirs.sort_by_key(|d| d.file_name());
    for dir in dirs {
        let slug_name = dir.file_name().to_string_lossy().into_owned();
        let fallback = slug::decode_slug_fs(&slug_name)
            .map(|(p, _)| p.to_string_lossy().into_owned())
            .unwrap_or_else(|| slug_name.clone());
        let Ok(files) = std::fs::read_dir(dir.path()) else {
            batch.failed_files += 1;
            continue;
        };
        let mut files: Vec<_> = files.flatten().collect();
        files.sort_by_key(|f| f.file_name());
        for f in files {
            let path = f.path();
            // Sibling dirs (e.g. `memory/`) and non-log files are not sessions.
            if !path.is_file() || path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
                continue;
            }
            let key = path.to_string_lossy().into_owned();
            let from = cursor.offsets.get(&key).copied().unwrap_or(0);
            let Ok(indexed) = index_file(&path, from, &fallback) else {
                // Leave the cursor alone so the next sweep retries this file.
                batch.failed_files += 1;
                continue;
            };
            let advanced = indexed.new_offset != from || from == 0;
            cursor.offsets.insert(key, indexed.new_offset);
            batch.skipped_lines += indexed.skipped_lines;
            if indexed.reset {
                batch.reset_sessions.push(indexed.session.id.clone());
            }
            let has_news = indexed.session.turns > 0
                || !indexed.invocations.is_empty()
                || indexed.session.ended_at.is_some()
                || !indexed.orphan_results.is_empty();
            if advanced && (from == 0 || has_news) {
                batch.sessions.push(indexed.session);
            }
            batch.invocations.extend(indexed.invocations);
            batch.orphan_results.extend(indexed.orphan_results);
        }
    }
    batch
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::claude_code::slug;
    use crate::harness::claude_code::test_support::fixture_home;
    use crate::harness::model::InvocationKind as K;

    /// (kind, target, duration_ms, is_error, turn_tokens) — one asserted row.
    type Row<'a> = (K, &'a str, Option<i64>, bool, Option<i64>);

    fn log_of(home: &ClaudeHome) -> std::path::PathBuf {
        home.projects_dir()
            .join(slug::encode(&home.root.join("work/app")))
            .join("0001-session.jsonl")
    }

    #[test]
    fn epoch_ms_parses_log_timestamps() {
        assert_eq!(epoch_ms("1970-01-01T00:00:01.500Z"), Some(1500));
        assert_eq!(
            epoch_ms("2026-08-01T10:00:00.000Z").map(|v| v % 1000),
            Some(0)
        );
        assert_eq!(epoch_ms("garbage"), None);
    }

    /// Non-ASCII digits in the millis field must not be byte-sliced.
    #[test]
    fn epoch_ms_rejects_non_ascii_millis_without_panicking() {
        assert_eq!(epoch_ms("2026-08-01T10:00:00.\u{1D7D8}Z"), None);
        assert_eq!(epoch_ms("2026-08-01T10:00:00.\u{1F600}Z"), None);
    }

    /// Absurd field values must not overflow the civil-days math (panic=abort).
    #[test]
    fn epoch_ms_rejects_out_of_range_fields_without_overflowing() {
        assert_eq!(epoch_ms("300000000000-01-01T00:00:00.000Z"), None);
        assert_eq!(epoch_ms("2026-01-99999999999T00:00:00.000Z"), None);
    }

    #[test]
    fn full_index_of_fixture_session() {
        let (_g, home) = fixture_home();
        let app = home.root.join("work/app");
        let log = log_of(&home);
        let r = index_file(&log, 0, "/fallback").unwrap();
        assert_eq!(r.session.id, "0001-session");
        assert_eq!(r.session.project_path, app.to_string_lossy());
        assert_eq!(r.session.log_path, log.to_string_lossy());
        assert_eq!(
            r.session.started_at.as_deref(),
            Some("2026-08-01T10:00:00.000Z")
        );
        assert_eq!(
            r.session.ended_at.as_deref(),
            Some("2026-08-01T10:00:20.000Z")
        );
        assert_eq!(
            (
                r.session.turns,
                r.session.input_tokens,
                r.session.output_tokens
            ),
            (5, 330, 150)
        );
        assert_eq!(r.session.model.as_deref(), Some("claude-fable-5"));
        assert_eq!(r.skipped_lines, 1);
        assert!(!r.reset);
        assert_eq!(r.invocations.len(), 5);
        assert_eq!(
            r.invocations
                .iter()
                .map(|i| i.tool_use_id.as_str())
                .collect::<Vec<_>>(),
            vec!["t1", "t2", "t3", "t4", "t5"]
        );
        let by_id: Vec<Row> = r
            .invocations
            .iter()
            .map(|i| {
                (
                    i.kind,
                    i.target.as_str(),
                    i.duration_ms,
                    i.is_error,
                    i.turn_tokens,
                )
            })
            .collect();
        assert_eq!(
            by_id,
            vec![
                (K::Skill, "adapt", Some(2500), false, Some(360)),
                (K::Agent, "reviewer", Some(10000), false, Some(25)),
                (K::Mcp, "playwright", Some(1000), true, Some(35)),
                (K::Builtin, "Bash", Some(200), false, Some(15)),
                (K::Skill, "superpowers:brainstorming", None, false, Some(45)),
            ]
        );
        assert_eq!(r.new_offset, std::fs::metadata(&log).unwrap().len());
    }

    #[test]
    fn resume_reads_only_new_lines_and_shrink_resets() {
        let (_g, home) = fixture_home();
        let log = log_of(&home);
        let first = index_file(&log, 0, "/f").unwrap();
        let again = index_file(&log, first.new_offset, "/f").unwrap();
        assert!(again.invocations.is_empty());
        assert_eq!(again.new_offset, first.new_offset);
        assert!(!again.reset);

        let mut f = std::fs::OpenOptions::new().append(true).open(&log).unwrap();
        use std::io::Write;
        writeln!(f, r#"{{"type":"assistant","timestamp":"2026-08-01T10:01:00.000Z","message":{{"model":"m","usage":{{"input_tokens":1,"output_tokens":1}},"content":[{{"type":"tool_use","id":"t9","name":"Read","input":{{}}}}]}}}}"#).unwrap();
        let tail = index_file(&log, first.new_offset, "/f").unwrap();
        assert_eq!(tail.invocations.len(), 1);
        assert_eq!(tail.invocations[0].tool_name, "Read");
        assert_eq!(tail.invocations[0].tool_use_id, "t9");
        // No `cwd` on the appended line: the fallback stands in.
        assert_eq!(tail.invocations[0].project_path, "/f");
        assert!(!tail.reset);

        std::fs::write(&log, "").unwrap();
        let reset = index_file(&log, tail.new_offset, "/f").unwrap();
        assert_eq!(reset.new_offset, 0);
        assert!(reset.reset);
    }

    /// A `tool_result` whose `tool_use` landed in an earlier pass has no
    /// pending entry to attach to; it must still reach the store.
    #[test]
    fn tool_result_without_a_pending_use_becomes_an_orphan() {
        let (_g, home) = fixture_home();
        let log = log_of(&home);
        let first = index_file(&log, 0, "/f").unwrap();
        assert!(first.orphan_results.is_empty());

        let mut f = std::fs::OpenOptions::new().append(true).open(&log).unwrap();
        use std::io::Write;
        writeln!(f, r#"{{"type":"user","timestamp":"2026-08-01T10:00:25.000Z","message":{{"content":[{{"type":"tool_result","tool_use_id":"t5","content":"ok"}}]}}}}"#).unwrap();

        let tail = index_file(&log, first.new_offset, "/f").unwrap();
        assert!(tail.invocations.is_empty());
        assert_eq!(tail.orphan_results.len(), 1);
        let o = &tail.orphan_results[0];
        assert_eq!(o.tool_use_id, "t5");
        assert!(!o.is_error);
        assert_eq!(o.session_id, "0001-session");
        assert_eq!(o.end_ms, epoch_ms("2026-08-01T10:00:25.000Z").unwrap());

        let mut cursor = UsageCursor::default();
        cursor
            .offsets
            .insert(log.to_string_lossy().into_owned(), first.new_offset);
        let batch = index_all(&home, &mut cursor);
        assert_eq!(batch.orphan_results.len(), 1);
        // Range-scoped ts alone must still surface the session row.
        assert_eq!(batch.sessions.len(), 1);
    }

    /// Invalid UTF-8 must not stall a log forever: the line is read lossily.
    #[test]
    fn invalid_utf8_line_does_not_stall_the_cursor() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("s.jsonl");
        let mut bytes = br#"{"type":"mode","mode":""#.to_vec();
        bytes.extend_from_slice(&[0xFF, 0xFE]);
        bytes.extend_from_slice(b"\"}\nnot json at all\n");
        std::fs::write(&log, &bytes).unwrap();
        let r = index_file(&log, 0, "/f").unwrap();
        assert_eq!(r.new_offset, bytes.len() as u64);
        assert_eq!(r.skipped_lines, 1);
    }

    #[test]
    fn partial_trailing_line_is_not_consumed() {
        let dir = tempfile::tempdir().unwrap();
        let log = dir.path().join("s.jsonl");
        std::fs::write(&log, "{\"type\":\"mode\"}\n{\"type\":\"assis").unwrap();
        let r = index_file(&log, 0, "/f").unwrap();
        assert_eq!(r.new_offset, "{\"type\":\"mode\"}\n".len() as u64);
        assert_eq!(r.skipped_lines, 0);
    }

    #[test]
    fn index_all_walks_every_project_dir_and_updates_cursor() {
        let (_g, home) = fixture_home();
        let mut cursor = UsageCursor::default();
        let batch = index_all(&home, &mut cursor);
        assert_eq!(batch.sessions.len(), 1);
        assert_eq!(batch.invocations.len(), 5);
        assert_eq!(batch.skipped_lines, 1);
        assert!(batch.reset_sessions.is_empty());
        assert!(batch.orphan_results.is_empty());
        assert_eq!(batch.failed_files, 0);
        assert_eq!(cursor.offsets.len(), 1);
        let second = index_all(&home, &mut cursor);
        assert!(second.invocations.is_empty());
        assert!(second.reset_sessions.is_empty());
    }

    #[test]
    fn index_all_reports_shrunk_sessions_as_reset() {
        let (_g, home) = fixture_home();
        let mut cursor = UsageCursor::default();
        index_all(&home, &mut cursor);
        std::fs::write(log_of(&home), "").unwrap();
        let after = index_all(&home, &mut cursor);
        assert_eq!(after.reset_sessions, vec!["0001-session".to_string()]);
        assert_eq!(
            cursor.offsets.values().copied().collect::<Vec<_>>(),
            vec![0]
        );
    }
}
