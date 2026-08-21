use std::path::Path;

use super::inventory::{self, Ctx};
use super::paths::ClaudeHome;
use crate::harness::model::{Artifact, ArtifactKind, Layer};

pub fn plugin_artifacts(home: &ClaudeHome) -> Vec<Artifact> {
    let Ok(text) = std::fs::read_to_string(home.plugins_manifest()) else {
        return Vec::new();
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else {
        return Vec::new();
    };
    let mut out = Vec::new();
    let Some(plugins) = json.get("plugins").and_then(|p| p.as_object()) else {
        return out;
    };
    for (key, installs) in plugins {
        let (name, marketplace) = key.split_once('@').unwrap_or((key.as_str(), ""));
        for inst in installs.as_array().into_iter().flatten() {
            let Some(install_path) = inst.get("installPath").and_then(|p| p.as_str()) else {
                continue;
            };
            let version = inst
                .get("version")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            let ctx = Ctx {
                layer: Layer::Plugin,
                project_path: None,
                plugin_name: Some(name),
            };
            let root = Path::new(install_path);
            out.push(ctx.artifact(
                ArtifactKind::Plugin,
                name.to_string(),
                root,
                Some(format!("v{version} · {marketplace}")),
                text.as_bytes(),
            ));
            inventory::skills(&ctx, &mut out, &root.join("skills"));
            inventory::md_files(&ctx, &mut out, &root.join("agents"), ArtifactKind::Agent);
            inventory::md_files(
                &ctx,
                &mut out,
                &root.join("commands"),
                ArtifactKind::Command,
            );
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::harness::claude_code::test_support::fixture_home;
    use crate::harness::model::{ArtifactKind as K, Layer};

    #[test]
    fn installed_plugins_and_their_bundles_are_listed() {
        let (_g, home) = fixture_home();
        let a = plugin_artifacts(&home);
        let plugin = a
            .iter()
            .find(|x| x.kind == K::Plugin)
            .expect("plugin artifact");
        assert_eq!(plugin.name, "superpowers");
        assert_eq!(
            plugin.description.as_deref(),
            Some("v6.3.0 · claude-plugins-official")
        );
        let skill = a.iter().find(|x| x.kind == K::Skill).unwrap();
        assert_eq!(
            (
                skill.name.as_str(),
                skill.layer,
                skill.plugin_name.as_deref()
            ),
            ("brainstorming", Layer::Plugin, Some("superpowers"))
        );
        assert!(a
            .iter()
            .any(|x| x.kind == K::Agent && x.name == "code-reviewer"));
    }

    #[test]
    fn missing_manifest_is_empty() {
        let dir = tempfile::tempdir().unwrap();
        assert!(plugin_artifacts(&ClaudeHome::at(dir.path())).is_empty());
    }
}
