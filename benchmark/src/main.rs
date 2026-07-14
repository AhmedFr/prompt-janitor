//! CLI entry for the offline benchmark harness.

mod effects;
mod fixture;
mod metrics;
mod review;
mod runner;
mod stats;
mod verify;

use effects::{EffectsTable, GeneratedWith};
use std::path::Path;

/// Parsed CLI invocation.
#[derive(Debug, PartialEq)]
enum Cmd {
    List,
    Run { fixture: String, n: usize },
}

/// Parse argv (excluding the program name). `--n` defaults to 20.
fn parse_args(args: &[String]) -> Result<Cmd, String> {
    match args.first().map(String::as_str) {
        Some("list") => Ok(Cmd::List),
        Some("run") => {
            let fixture = args
                .get(1)
                .cloned()
                .ok_or_else(|| "run needs a fixture name".to_string())?;
            let n = match args.iter().position(|a| a == "--n") {
                Some(i) => args
                    .get(i + 1)
                    .and_then(|v| v.parse().ok())
                    .ok_or_else(|| "--n needs a number".to_string())?,
                None => 20,
            };
            Ok(Cmd::Run { fixture, n })
        }
        _ => Err("usage: benchmark <list|run> [fixture] [--n N]".to_string()),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cmd = match parse_args(&args) {
        Ok(c) => c,
        Err(e) => { eprintln!("{e}"); std::process::exit(2); }
    };
    let fixtures_root = Path::new("fixtures");
    match cmd {
        Cmd::List => {
            for e in std::fs::read_dir(fixtures_root).expect("fixtures/ dir") {
                let e = e.unwrap();
                if e.file_type().unwrap().is_dir() {
                    println!("{}", e.file_name().to_string_lossy());
                }
            }
        }
        Cmd::Run { fixture, n } => {
            let model = std::env::var("BENCH_MODEL").unwrap_or_else(|_| "claude-opus-4-8".into());
            let cc_version = std::env::var("BENCH_CC_VERSION").unwrap_or_else(|_| "unknown".into());
            let gen = GeneratedWith { model: model.clone(), cc_version, temperature: 0.0 };
            let fx = fixture::load(fixtures_root, &fixture).expect("load fixture");
            let agent = runner::ClaudeAgent { model: model.clone(), temperature: 0.0 };
            let reviewer = review::ClaudeReviewer { model };
            let row = runner::run_fixture(&fx, n, &agent, &reviewer, gen.clone());
            let table = EffectsTable {
                suite_version: std::env::var("BENCH_SUITE_VERSION")
                    .unwrap_or_else(|_| "0.0.0-dev".into()),
                generated_with: gen,
                rules: vec![row],
            };
            table.write(Path::new("effects.json"));
            println!("wrote effects.json");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(s: &[&str]) -> Vec<String> {
        s.iter().map(|x| x.to_string()).collect()
    }

    #[test]
    fn parses_run_with_default_n() {
        assert_eq!(
            parse_args(&v(&["run", "missing_few_shot"])).unwrap(),
            Cmd::Run { fixture: "missing_few_shot".into(), n: 20 }
        );
    }

    #[test]
    fn parses_run_with_explicit_n() {
        assert_eq!(
            parse_args(&v(&["run", "x", "--n", "5"])).unwrap(),
            Cmd::Run { fixture: "x".into(), n: 5 }
        );
    }

    #[test]
    fn list_parses() {
        assert_eq!(parse_args(&v(&["list"])).unwrap(), Cmd::List);
    }
}
