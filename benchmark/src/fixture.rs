//! Load a benchmark fixture directory into a `Fixture`.

use serde::Deserialize;
use std::path::{Path, PathBuf};

/// A rule-indexed fixture: identical task + two CLAUDE.md variants.
#[derive(Debug, Clone, PartialEq)]
pub struct Fixture {
    /// Engine `Rule::id()` this fixture proves (e.g. "encourage-examples").
    pub rule: String,
    pub task: String,
    pub claude_good: String,
    pub claude_bad: String,
    /// The fixture directory (holds `repo/` and `verify.sh`).
    pub dir: PathBuf,
}

#[derive(Deserialize)]
struct Meta {
    rule: String,
}

/// Load `<fixtures_root>/<name>`. Errors if the dir or any required file is missing.
pub fn load(fixtures_root: &Path, name: &str) -> Result<Fixture, String> {
    let dir = fixtures_root.join(name);
    if !dir.is_dir() {
        return Err(format!("fixture dir not found: {}", dir.display()));
    }
    let read = |file: &str| {
        std::fs::read_to_string(dir.join(file))
            .map_err(|e| format!("{file}: {e}"))
    };
    let meta: Meta = serde_json::from_str(&read("meta.json")?).map_err(|e| e.to_string())?;
    Ok(Fixture {
        rule: meta.rule,
        task: read("task.md")?,
        claude_good: read("claude.good.md")?,
        claude_bad: read("claude.bad.md")?,
        dir,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_fixture(root: &Path, name: &str) -> PathBuf {
        let d = root.join(name);
        std::fs::create_dir_all(d.join("repo")).unwrap();
        std::fs::write(d.join("meta.json"), r#"{"rule":"encourage-examples"}"#).unwrap();
        std::fs::write(d.join("task.md"), "do the thing").unwrap();
        std::fs::write(d.join("claude.good.md"), "GOOD").unwrap();
        std::fs::write(d.join("claude.bad.md"), "BAD").unwrap();
        std::fs::write(d.join("verify.sh"), "exit 0").unwrap();
        d
    }

    #[test]
    fn loads_a_well_formed_fixture() {
        let root = tempfile::tempdir().unwrap();
        write_fixture(root.path(), "missing_few_shot");
        let f = load(root.path(), "missing_few_shot").unwrap();
        assert_eq!(f.rule, "encourage-examples");
        assert_eq!(f.task, "do the thing");
        assert_eq!(f.claude_good, "GOOD");
        assert_eq!(f.claude_bad, "BAD");
    }

    #[test]
    fn missing_dir_errors() {
        let root = tempfile::tempdir().unwrap();
        assert!(load(root.path(), "nope").is_err());
    }
}
