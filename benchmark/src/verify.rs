//! Run a fixture's deterministic verifier (`verify.sh`) → pass/fail.

use std::path::Path;
use std::process::Command;

/// Run `script` with its working directory set to `repo_dir`.
/// Returns `true` iff the process exits 0. A failure to spawn is `false`.
pub fn run_verifier(repo_dir: &Path, script: &Path) -> bool {
    Command::new("sh")
        .arg(script)
        .current_dir(repo_dir)
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn script(dir: &Path, body: &str) -> std::path::PathBuf {
        let p = dir.join("verify.sh");
        let mut f = std::fs::File::create(&p).unwrap();
        writeln!(f, "#!/bin/sh\n{body}").unwrap();
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&p, std::fs::Permissions::from_mode(0o755)).unwrap();
        }
        p
    }

    #[test]
    fn passing_script_returns_true() {
        let dir = tempfile::tempdir().unwrap();
        let s = script(dir.path(), "exit 0");
        assert!(run_verifier(dir.path(), &s));
    }

    #[test]
    fn failing_script_returns_false() {
        let dir = tempfile::tempdir().unwrap();
        let s = script(dir.path(), "exit 1");
        assert!(!run_verifier(dir.path(), &s));
    }

    #[test]
    fn runs_in_repo_dir() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("marker"), "x").unwrap();
        let s = script(dir.path(), "test -f marker");
        assert!(run_verifier(dir.path(), &s));
    }
}
