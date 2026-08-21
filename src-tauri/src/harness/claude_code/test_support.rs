#![cfg(test)]
use std::fs;
use std::path::Path;

use super::paths::ClaudeHome;
use super::slug;

fn copy_dir(from: &Path, to: &Path) {
    fs::create_dir_all(to).unwrap();
    for entry in fs::read_dir(from).unwrap() {
        let entry = entry.unwrap();
        let dest = to.join(entry.file_name());
        if entry.file_type().unwrap().is_dir() {
            copy_dir(&entry.path(), &dest);
        } else {
            fs::copy(entry.path(), dest).unwrap();
        }
    }
}

fn rewrite(path: &Path, from: &str, to: &str) {
    let s = fs::read_to_string(path).unwrap();
    fs::write(path, s.replace(from, to)).unwrap();
}

/// Copies `tests/fixtures/claude_home` into a tempdir and patches the
/// placeholders so every path inside is real. Returns (guard, home).
pub fn fixture_home() -> (tempfile::TempDir, ClaudeHome) {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/claude_home");
    let tmp = tempfile::tempdir().unwrap();
    copy_dir(&src, tmp.path());
    let root = tmp.path().canonicalize().unwrap();
    let root_str = root.to_string_lossy().into_owned();

    let app_path = root.join("work/app");
    let projects = root.join("projects");
    fs::rename(
        projects.join("-FIXTURE-work-app"),
        projects.join(slug::encode(&app_path)),
    )
    .unwrap();
    fs::rename(
        projects.join("-FIXTURE-work-gone"),
        projects.join(slug::encode(&root.join("work/gone"))),
    )
    .unwrap();
    let log = projects
        .join(slug::encode(&app_path))
        .join("0001-session.jsonl");
    rewrite(&log, "<FIXTURE>", &root_str);
    rewrite(
        &root.join("plugins/installed_plugins.json"),
        "<FIXTURE>",
        &root_str,
    );
    (tmp, ClaudeHome::at(root))
}

#[test]
fn fixture_home_is_self_consistent() {
    let (_g, home) = fixture_home();
    assert!(home.global_rule().is_file());
    assert!(home.root.join("work/app/CLAUDE.md").is_file());
    let slug_dir = home
        .projects_dir()
        .join(slug::encode(&home.root.join("work/app")));
    assert!(slug_dir.join("0001-session.jsonl").is_file());
    assert_eq!(
        slug::decode_slug_fs(slug_dir.file_name().unwrap().to_str().unwrap()),
        Some(home.root.join("work/app"))
    );
}
