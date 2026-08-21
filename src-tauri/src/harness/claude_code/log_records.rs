//! Typed view of one line of a Claude Code session log. Only the fields the
//! indexer needs are extracted; everything else is ignored, never rejected.

use serde_json::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolUse {
    pub id: String,
    pub name: String,
    pub input: Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolResult {
    pub tool_use_id: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LogRecord {
    Assistant {
        ts: String,
        cwd: Option<String>,
        model: Option<String>,
        /// Total context processed for this turn: fresh input plus
        /// `cache_creation_input_tokens` plus `cache_read_input_tokens`.
        /// Cached reads are cheaper but still context the model had to carry,
        /// so bloat shows up here even when the cache absorbs the cost.
        input_tokens: i64,
        output_tokens: i64,
        tool_uses: Vec<ToolUse>,
    },
    ToolResults {
        ts: String,
        cwd: Option<String>,
        results: Vec<ToolResult>,
    },
    Other {
        ts: Option<String>,
        cwd: Option<String>,
    },
}

fn s(v: &Value, key: &str) -> Option<String> {
    v.get(key).and_then(Value::as_str).map(str::to_string)
}

pub fn parse_line(line: &str) -> Option<LogRecord> {
    let v: Value = serde_json::from_str(line.trim()).ok()?;
    let ts = s(&v, "timestamp");
    let cwd = s(&v, "cwd");
    let content = v.pointer("/message/content").and_then(Value::as_array);
    match v.get("type").and_then(Value::as_str) {
        Some("assistant") => {
            let usage = v.pointer("/message/usage");
            let tok = |k: &str| {
                usage
                    .and_then(|u| u.get(k))
                    .and_then(Value::as_i64)
                    .unwrap_or(0)
            };
            let tool_uses = content
                .into_iter()
                .flatten()
                .filter(|b| b.get("type").and_then(Value::as_str) == Some("tool_use"))
                .filter_map(|b| {
                    Some(ToolUse {
                        id: s(b, "id")?,
                        name: s(b, "name")?,
                        input: b.get("input").cloned().unwrap_or(Value::Null),
                    })
                })
                .collect();
            Some(LogRecord::Assistant {
                ts: ts.unwrap_or_default(),
                cwd,
                model: v
                    .pointer("/message/model")
                    .and_then(Value::as_str)
                    .map(str::to_string),
                input_tokens: tok("input_tokens")
                    + tok("cache_creation_input_tokens")
                    + tok("cache_read_input_tokens"),
                output_tokens: tok("output_tokens"),
                tool_uses,
            })
        }
        Some("user") => {
            let results: Vec<ToolResult> = content
                .into_iter()
                .flatten()
                .filter(|b| b.get("type").and_then(Value::as_str) == Some("tool_result"))
                .filter_map(|b| {
                    Some(ToolResult {
                        tool_use_id: s(b, "tool_use_id")?,
                        is_error: b.get("is_error").and_then(Value::as_bool).unwrap_or(false),
                    })
                })
                .collect();
            if results.is_empty() {
                Some(LogRecord::Other { ts, cwd })
            } else {
                Some(LogRecord::ToolResults {
                    ts: ts.unwrap_or_default(),
                    cwd,
                    results,
                })
            }
        }
        _ => Some(LogRecord::Other { ts, cwd }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_assistant_tool_use_with_usage() {
        let line = r#"{"type":"assistant","timestamp":"2026-08-01T10:00:01.000Z","cwd":"/p","message":{"model":"m","usage":{"input_tokens":10,"cache_creation_input_tokens":100,"cache_read_input_tokens":200,"output_tokens":50},"content":[{"type":"tool_use","id":"t1","name":"Skill","input":{"skill":"adapt"}},{"type":"text","text":"hi"}]}}"#;
        match parse_line(line).unwrap() {
            LogRecord::Assistant {
                ts,
                cwd,
                model,
                input_tokens,
                output_tokens,
                tool_uses,
            } => {
                assert_eq!(
                    (ts.as_str(), cwd.as_deref(), model.as_deref()),
                    ("2026-08-01T10:00:01.000Z", Some("/p"), Some("m"))
                );
                // input is the total context processed: fresh + cache-write + cache-read.
                assert_eq!((input_tokens, output_tokens), (310, 50));
                assert_eq!(tool_uses.len(), 1);
                assert_eq!(tool_uses[0].name, "Skill");
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn parses_tool_results_and_error_flag() {
        let line = r#"{"type":"user","timestamp":"t","message":{"content":[{"type":"tool_result","tool_use_id":"t3","is_error":true,"content":"x"},{"type":"tool_result","tool_use_id":"t4","content":"y"}]}}"#;
        match parse_line(line).unwrap() {
            LogRecord::ToolResults { results, .. } => {
                assert_eq!(
                    results
                        .iter()
                        .map(|r| (r.tool_use_id.as_str(), r.is_error))
                        .collect::<Vec<_>>(),
                    vec![("t3", true), ("t4", false)]
                );
            }
            other => panic!("unexpected {other:?}"),
        }
    }

    #[test]
    fn plain_user_text_and_meta_records_are_other_and_garbage_is_none() {
        assert!(matches!(
            parse_line(r#"{"type":"user","message":{"content":[{"type":"text","text":"hi"}]}}"#),
            Some(LogRecord::Other { .. })
        ));
        assert!(matches!(
            parse_line(r#"{"type":"mode","mode":"normal"}"#),
            Some(LogRecord::Other { .. })
        ));
        assert!(parse_line("not json").is_none());
        assert!(parse_line("").is_none());
    }
}
