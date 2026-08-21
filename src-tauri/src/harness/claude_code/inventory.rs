//! Discover Claude Code artifacts on disk for one layer.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

use super::paths::ClaudeHome;
use crate::harness::model::{Artifact, ArtifactKind, Layer};

pub const HARNESS_ID: &str = "claude_code";

pub(super) fn content_hash(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
}

pub(super) fn frontmatter_field(content: &str, key: &str) -> Option<String> {
    let rest = content.strip_prefix("---")?;
    let end = rest.find("\n---")?;
    rest[..end]
        .lines()
        .filter_map(|l| l.split_once(':'))
        .find(|(k, _)| k.trim() == key)
        .map(|(_, v)| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

fn first_prose_line(content: &str) -> Option<String> {
    content
        .lines()
        .map(str::trim)
        .find(|l| !l.is_empty() && !l.starts_with('#') && !l.starts_with("---"))
        .map(|l| l.chars().take(120).collect())
}

pub(super) struct Ctx<'a> {
    pub(super) layer: Layer,
    pub(super) project_path: Option<&'a Path>,
    pub(super) plugin_name: Option<&'a str>,
}

impl Ctx<'_> {
    pub(super) fn artifact(
        &self,
        kind: ArtifactKind,
        name: String,
        file: &Path,
        description: Option<String>,
        bytes: &[u8],
    ) -> Artifact {
        Artifact {
            harness: HARNESS_ID.to_string(),
            layer: self.layer,
            project_path: self.project_path.map(|p| p.to_string_lossy().into_owned()),
            kind,
            name,
            path: file.to_string_lossy().into_owned(),
            plugin_name: self.plugin_name.map(|s| s.to_string()),
            description,
            bytes: bytes.len() as u64,
            hash: content_hash(bytes),
        }
    }
}

fn read(path: &Path) -> Option<(String, Vec<u8>)> {
    let bytes = fs::read(path).ok()?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    Some((text, bytes))
}

fn rule_files(ctx: &Ctx, out: &mut Vec<Artifact>, candidates: &[PathBuf]) {
    for f in candidates {
        if let Some((text, bytes)) = read(f) {
            let name = f
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            out.push(ctx.artifact(ArtifactKind::Rule, name, f, first_prose_line(&text), &bytes));
        }
    }
}

pub(super) fn skills(ctx: &Ctx, out: &mut Vec<Artifact>, dir: &Path) {
    let Ok(rd) = fs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let f = e.path().join("SKILL.md");
        let Some((text, bytes)) = read(&f) else {
            continue;
        };
        let fallback = e.file_name().to_string_lossy().into_owned();
        let name = frontmatter_field(&text, "name").unwrap_or(fallback);
        out.push(ctx.artifact(
            ArtifactKind::Skill,
            name,
            &f,
            frontmatter_field(&text, "description"),
            &bytes,
        ));
    }
}

pub(super) fn md_files(ctx: &Ctx, out: &mut Vec<Artifact>, dir: &Path, kind: ArtifactKind) {
    let Ok(rd) = fs::read_dir(dir) else {
        return;
    };
    for e in rd.flatten() {
        let f = e.path();
        if f.extension().and_then(|x| x.to_str()) != Some("md") {
            continue;
        }
        let Some((text, bytes)) = read(&f) else {
            continue;
        };
        let stem = f
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        let name = frontmatter_field(&text, "name").unwrap_or(stem);
        out.push(ctx.artifact(
            kind,
            name,
            &f,
            frontmatter_field(&text, "description"),
            &bytes,
        ));
    }
}

fn settings_file(ctx: &Ctx, out: &mut Vec<Artifact>, f: &Path, include_settings_artifact: bool) {
    let Some((text, bytes)) = read(f) else {
        return;
    };
    if include_settings_artifact {
        let name = f
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned();
        out.push(ctx.artifact(ArtifactKind::Settings, name, f, None, &bytes));
    }
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else {
        return;
    };
    if let Some(hooks) = json.get("hooks").and_then(|h| h.as_object()) {
        // Hook names must be unique within one settings file: a repeated
        // "<event>: <cmd>" name gets " #2", " #3", ... appended.
        let mut seen: HashMap<String, u32> = HashMap::new();
        for (event, matchers) in hooks {
            for m in matchers.as_array().into_iter().flatten() {
                for h in m
                    .get("hooks")
                    .and_then(|x| x.as_array())
                    .into_iter()
                    .flatten()
                {
                    let cmd = h
                        .get("command")
                        .and_then(|c| c.as_str())
                        .unwrap_or("(inline)");
                    let base: String = format!("{event}: {cmd}").chars().take(80).collect();
                    let count = seen.entry(base.clone()).or_insert(0);
                    *count += 1;
                    let name = if *count == 1 {
                        base
                    } else {
                        format!("{base} #{count}")
                    };
                    out.push(ctx.artifact(ArtifactKind::Hook, name, f, None, &bytes));
                }
            }
        }
    }
    if let Some(servers) = json.get("mcpServers").and_then(|s| s.as_object()) {
        for key in servers.keys() {
            out.push(ctx.artifact(ArtifactKind::McpServer, key.clone(), f, None, &bytes));
        }
    }
}

pub fn global_artifacts(home: &ClaudeHome) -> Vec<Artifact> {
    let ctx = Ctx {
        layer: Layer::Global,
        project_path: None,
        plugin_name: None,
    };
    let mut out = Vec::new();
    rule_files(&ctx, &mut out, &[home.global_rule()]);
    skills(&ctx, &mut out, &home.skills_dir());
    md_files(&ctx, &mut out, &home.agents_dir(), ArtifactKind::Agent);
    md_files(&ctx, &mut out, &home.commands_dir(), ArtifactKind::Command);
    for f in home.settings() {
        settings_file(&ctx, &mut out, &f, true);
    }
    out
}

pub fn project_artifacts(project: &Path) -> Vec<Artifact> {
    let ctx = Ctx {
        layer: Layer::Project,
        project_path: Some(project),
        plugin_name: None,
    };
    let mut out = Vec::new();
    rule_files(
        &ctx,
        &mut out,
        &[project.join("CLAUDE.md"), project.join("AGENTS.md")],
    );
    let dot = ClaudeHome::project_dot_claude(project);
    skills(&ctx, &mut out, &dot.join("skills"));
    md_files(&ctx, &mut out, &dot.join("agents"), ArtifactKind::Agent);
    md_files(&ctx, &mut out, &dot.join("commands"), ArtifactKind::Command);
    for name in ["settings.json", "settings.local.json"] {
        let f = dot.join(name);
        if f.is_file() {
            settings_file(&ctx, &mut out, &f, true);
        }
    }
    let mcp = project.join(".mcp.json");
    if mcp.is_file() {
        settings_file(&ctx, &mut out, &mcp, false);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::claude_code::test_support::fixture_home;
    use crate::harness::model::{ArtifactKind as K, Layer};

    fn names(a: &[Artifact], kind: K) -> Vec<String> {
        let mut v: Vec<String> = a
            .iter()
            .filter(|x| x.kind == kind)
            .map(|x| x.name.clone())
            .collect();
        v.sort();
        v
    }

    #[test]
    fn global_layer_finds_every_kind() {
        let (_g, home) = fixture_home();
        let a = global_artifacts(&home);
        assert!(a.iter().all(|x| x.layer == Layer::Global
            && x.harness == "claude_code"
            && x.project_path.is_none()));
        assert_eq!(names(&a, K::Rule), vec!["CLAUDE.md"]);
        assert_eq!(names(&a, K::Skill), vec!["adapt", "unused-skill"]);
        assert_eq!(names(&a, K::Agent), vec!["reviewer"]);
        assert_eq!(names(&a, K::Command), vec!["ship"]);
        assert_eq!(names(&a, K::Settings), vec!["settings.json"]);
        assert_eq!(names(&a, K::Hook), vec!["SessionStart: echo hi"]);
        assert_eq!(names(&a, K::McpServer), vec!["playwright"]);
        let adapt = a.iter().find(|x| x.name == "adapt").unwrap();
        assert_eq!(
            adapt.description.as_deref(),
            Some("Adapt designs across screen sizes.")
        );
        assert!(adapt.bytes > 0 && adapt.hash.len() == 64);
    }

    #[test]
    fn project_layer_reads_dot_claude_and_mcp_json() {
        let (_g, home) = fixture_home();
        let project = home.root.join("work/app");
        let a = project_artifacts(&project);
        assert!(a.iter().all(|x| x.layer == Layer::Project
            && x.project_path.as_deref() == Some(project.to_str().unwrap())));
        assert_eq!(names(&a, K::Rule), vec!["CLAUDE.md"]);
        assert_eq!(names(&a, K::Skill), vec!["deploy"]);
        assert_eq!(names(&a, K::McpServer), vec!["github", "supabase"]);
    }

    #[test]
    fn missing_dirs_yield_nothing_not_errors() {
        let dir = tempfile::tempdir().unwrap();
        assert!(global_artifacts(&ClaudeHome::at(dir.path())).is_empty());
        assert!(project_artifacts(dir.path()).is_empty());
    }

    #[test]
    fn frontmatter_parsing() {
        let md = "---\nname: x\ndescription: Hello there.\n---\n# body";
        assert_eq!(
            frontmatter_field(md, "description").as_deref(),
            Some("Hello there.")
        );
        assert_eq!(frontmatter_field("# no fm", "name"), None);
    }

    #[test]
    fn duplicate_hook_names_get_suffixed() {
        let dir = tempfile::tempdir().unwrap();
        let settings = dir.path().join("settings.json");
        fs::write(
            &settings,
            r#"{"hooks":{"SessionStart":[
                {"matcher":"","hooks":[{"type":"command","command":"echo hi"}]},
                {"matcher":"","hooks":[{"type":"command","command":"echo hi"}]}
            ]}}"#,
        )
        .unwrap();
        let ctx = Ctx {
            layer: Layer::Global,
            project_path: None,
            plugin_name: None,
        };
        let mut out = Vec::new();
        settings_file(&ctx, &mut out, &settings, false);
        let mut names: Vec<String> = out
            .iter()
            .filter(|x| x.kind == K::Hook)
            .map(|x| x.name.clone())
            .collect();
        names.sort();
        assert_eq!(
            names,
            vec!["SessionStart: echo hi", "SessionStart: echo hi #2"]
        );
    }
}
