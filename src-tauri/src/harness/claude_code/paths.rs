use std::path::{Path, PathBuf};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ClaudeHome {
    pub root: PathBuf,
}

impl ClaudeHome {
    pub fn at(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }
    /// `$CLAUDE_HOME` (tests / power users) else `~/.claude` when present.
    pub fn detect() -> Option<Self> {
        if let Ok(p) = std::env::var("CLAUDE_HOME") {
            let p = PathBuf::from(p);
            return p.is_dir().then_some(Self::at(p));
        }
        let home = std::env::var_os("HOME").map(PathBuf::from)?;
        let root = home.join(".claude");
        root.is_dir().then_some(Self::at(root))
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
        assert_eq!(
            home.plugins_manifest(),
            dir.path().join("plugins/installed_plugins.json")
        );
    }

    #[test]
    fn detect_honours_claude_home_env() {
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("CLAUDE_HOME", dir.path());
        assert_eq!(
            ClaudeHome::detect().map(|h| h.root),
            Some(dir.path().to_path_buf())
        );
        std::env::remove_var("CLAUDE_HOME");
    }
}
