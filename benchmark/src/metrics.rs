//! Parse Claude Code `--output-format stream-json` into run metrics.

use serde::Deserialize;

/// Outcome metrics for a single agent run.
#[derive(Debug, Clone, PartialEq)]
pub struct RunMetrics {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_creation_input_tokens: u64,
    pub cache_read_input_tokens: u64,
    pub num_turns: u32,
    /// Tool names in call order (e.g. "Task" => a subagent was spawned).
    pub tool_calls: Vec<String>,
    pub wall_clock_ms: u64,
}

impl RunMetrics {
    /// Total input tokens actually consumed, including prompt-cache creation
    /// and reads — the real cost driver. Raw `input_tokens` alone is tiny
    /// because most of the prompt is served from / written to cache.
    pub fn total_input_tokens(&self) -> u64 {
        self.input_tokens + self.cache_creation_input_tokens + self.cache_read_input_tokens
    }
}

#[derive(Deserialize)]
struct Line {
    #[serde(rename = "type")]
    kind: String,
    // assistant lines
    message: Option<Message>,
    // result line
    num_turns: Option<u32>,
    duration_ms: Option<u64>,
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct Message {
    #[serde(default)]
    content: Vec<Block>,
}

#[derive(Deserialize)]
struct Block {
    #[serde(rename = "type")]
    kind: String,
    name: Option<String>,
}

#[derive(Deserialize)]
struct Usage {
    input_tokens: u64,
    output_tokens: u64,
    #[serde(default)]
    cache_creation_input_tokens: u64,
    #[serde(default)]
    cache_read_input_tokens: u64,
}

/// Parse a `stream-json` transcript. Collects tool names from assistant
/// `tool_use` blocks and reads the terminal `result` line for tokens, turns,
/// and wall-clock. Errors if there is no `result` line.
pub fn parse_stream(text: &str) -> Result<RunMetrics, String> {
    let mut tool_calls = Vec::new();
    let mut result: Option<(u32, u64, Usage)> = None;

    for raw in text.lines().filter(|l| !l.trim().is_empty()) {
        let line: Line = serde_json::from_str(raw).map_err(|e| e.to_string())?;
        match line.kind.as_str() {
            "assistant" => {
                if let Some(msg) = line.message {
                    for b in msg.content {
                        if b.kind == "tool_use" {
                            if let Some(name) = b.name {
                                tool_calls.push(name);
                            }
                        }
                    }
                }
            }
            "result" => {
                let turns = line.num_turns.ok_or("result missing num_turns")?;
                let ms = line.duration_ms.ok_or("result missing duration_ms")?;
                let usage = line.usage.ok_or("result missing usage")?;
                result = Some((turns, ms, usage));
            }
            _ => {}
        }
    }

    let (num_turns, wall_clock_ms, usage) = result.ok_or("no result line in stream")?;
    Ok(RunMetrics {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens,
        cache_read_input_tokens: usage.cache_read_input_tokens,
        num_turns,
        tool_calls,
        wall_clock_ms,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_captured_sample() {
        let text = include_str!("../testdata/claude_stream_sample.jsonl");
        let m = parse_stream(text).expect("sample should parse");
        // The sample run wrote a file, so it used at least one tool and
        // reported non-zero token usage across at least one turn.
        assert!(m.num_turns >= 1, "expected >=1 turn, got {}", m.num_turns);
        assert!(m.input_tokens > 0 && m.output_tokens > 0);
        assert!(!m.tool_calls.is_empty(), "expected at least one tool call");
        assert!(m.cache_read_input_tokens > 0, "real sample has prompt-cache reads");
        assert!(m.total_input_tokens() > m.input_tokens, "cache tokens dominate raw input");
    }

    #[test]
    fn parses_synthetic_minimal_stream() {
        let text = concat!(
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Write"}]}}"#, "\n",
            r#"{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Task"}]}}"#, "\n",
            r#"{"type":"result","num_turns":3,"duration_ms":8100,"usage":{"input_tokens":1200,"output_tokens":540}}"#, "\n"
        );
        let m = parse_stream(text).unwrap();
        assert_eq!(m.num_turns, 3);
        assert_eq!(m.input_tokens, 1200);
        assert_eq!(m.output_tokens, 540);
        assert_eq!(m.wall_clock_ms, 8100);
        assert_eq!(m.tool_calls, vec!["Write".to_string(), "Task".to_string()]);
        assert_eq!(m.cache_creation_input_tokens, 0);
        assert_eq!(m.cache_read_input_tokens, 0);
        assert_eq!(m.total_input_tokens(), 1200);
    }

    #[test]
    fn errors_when_no_result_line() {
        let text = r#"{"type":"assistant","message":{"content":[]}}"#;
        assert!(parse_stream(text).is_err());
    }
}
