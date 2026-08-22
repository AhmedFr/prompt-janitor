use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClaudeHome {
    pub root: PathBuf,
    /// Test seam: `~/.claude.json` sits *beside* the home, which a fixture
    /// tree copied into a tempdir cannot reproduce. `None` in production.
    pub user_config_override: Option<PathBuf>,
}

impl ClaudeHome {
    pub fn at(root: impl Into<PathBuf>) -> Self {
        Self {
            root: root.into(),
            user_config_override: None,
        }
    }
    /// `$CLAUDE_CONFIG_DIR` (Claude Code's own override), else `$CLAUDE_HOME`
    /// (tests / power users), else `~/.claude` when present.
    pub fn detect() -> Option<Self> {
        Self::detect_from(&|k| std::env::var(k).ok())
    }

    /// Pure form of [`detect`]: `get` supplies the environment, so the
    /// precedence rules are testable without mutating the process env.
    pub fn detect_from(get: &dyn Fn(&str) -> Option<String>) -> Option<Self> {
        let root = match get("CLAUDE_CONFIG_DIR").or_else(|| get("CLAUDE_HOME")) {
            Some(p) => PathBuf::from(p),
            None => PathBuf::from(get("HOME")?).join(".claude"),
        };
        if !root.is_dir() {
            return None;
        }
        // Symlinked/relative homes must compare equal to paths we read off disk.
        Some(Self::at(root.canonicalize().ok()?))
    }
    /// `~/.claude.json` — Claude Code's user config, a sibling of `~/.claude`.
    /// Holds the globally-installed `mcpServers` and, under `projects`, the
    /// per-project ones (keyed by absolute path).
    pub fn user_config(&self) -> PathBuf {
        if let Some(p) = &self.user_config_override {
            return p.clone();
        }
        match self.root.parent() {
            Some(parent) => parent.join(".claude.json"),
            None => self.root.join("../.claude.json"),
        }
    }
    pub fn global_rule(&self) -> PathBuf {
        self.root.join("CLAUDE.md")
    }
    pub fn settings(&self) -> Vec<PathBuf> {
        ["settings.json", "settings.local.json"]
            .iter()
            .map(|f| self.root.join(f))
            .filter(|p| p.is_file())
            .collect()
    }
    pub fn skills_dir(&self) -> PathBuf {
        self.root.join("skills")
    }
    pub fn agents_dir(&self) -> PathBuf {
        self.root.join("agents")
    }
    pub fn commands_dir(&self) -> PathBuf {
        self.root.join("commands")
    }
    pub fn plugins_manifest(&self) -> PathBuf {
        self.root.join("plugins").join("installed_plugins.json")
    }
    pub fn projects_dir(&self) -> PathBuf {
        self.root.join("projects")
    }
    pub fn project_dot_claude(project: &Path) -> PathBuf {
        project.join(".claude")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_well_known_paths_and_only_existing_settings() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("settings.json"), "{}").unwrap();
        let home = ClaudeHome::at(dir.path());
        assert_eq!(home.global_rule(), dir.path().join("CLAUDE.md"));
        assert_eq!(home.settings(), vec![dir.path().join("settings.json")]);
        assert_eq!(home.projects_dir(), dir.path().join("projects"));
        // `~/.claude.json` is a sibling of `~/.claude`, not a child.
        assert_eq!(
            home.user_config(),
            dir.path().parent().unwrap().join(".claude.json")
        );
        assert_eq!(
            home.plugins_manifest(),
            dir.path().join("plugins/installed_plugins.json")
        );
    }

    /// Fake environment: only the listed keys are set.
    fn env<'a>(vars: &'a [(&'a str, String)]) -> impl Fn(&str) -> Option<String> + 'a {
        move |k| {
            vars.iter()
                .find(|(name, _)| *name == k)
                .map(|(_, v)| v.clone())
        }
    }

    fn s(p: &Path) -> String {
        p.to_string_lossy().into_owned()
    }

    #[test]
    fn config_dir_override_wins_over_claude_home_and_home() {
        let cfg = tempfile::tempdir().unwrap();
        let other = tempfile::tempdir().unwrap();
        let got = ClaudeHome::detect_from(&env(&[
            ("CLAUDE_CONFIG_DIR", s(cfg.path())),
            ("CLAUDE_HOME", s(other.path())),
            ("HOME", s(other.path())),
        ]));
        assert_eq!(
            got.map(|h| h.root),
            Some(cfg.path().canonicalize().unwrap())
        );
    }

    #[test]
    fn claude_home_is_used_when_config_dir_is_unset() {
        let dir = tempfile::tempdir().unwrap();
        let got = ClaudeHome::detect_from(&env(&[("CLAUDE_HOME", s(dir.path()))]));
        assert_eq!(
            got.map(|h| h.root),
            Some(dir.path().canonicalize().unwrap())
        );
    }

    #[test]
    fn falls_back_to_dot_claude_under_home() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir(dir.path().join(".claude")).unwrap();
        let got = ClaudeHome::detect_from(&env(&[("HOME", s(dir.path()))]));
        assert_eq!(
            got.map(|h| h.root),
            Some(dir.path().join(".claude").canonicalize().unwrap())
        );
    }

    #[test]
    fn user_config_override_wins_over_the_sibling_path() {
        let dir = tempfile::tempdir().unwrap();
        let mut home = ClaudeHome::at(dir.path());
        home.user_config_override = Some(dir.path().join("user.claude.json"));
        assert_eq!(home.user_config(), dir.path().join("user.claude.json"));
    }

    #[test]
    fn override_that_is_not_a_directory_detects_nothing() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("not-a-dir");
        std::fs::write(&file, "x").unwrap();
        assert_eq!(
            ClaudeHome::detect_from(&env(&[("CLAUDE_CONFIG_DIR", s(&file))])),
            None
        );
        assert_eq!(
            ClaudeHome::detect_from(&env(&[("CLAUDE_HOME", s(&file))])),
            None
        );
        assert_eq!(ClaudeHome::detect_from(&env(&[])), None);
    }
}
