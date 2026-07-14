//! CLI entry for the offline benchmark harness.

mod effects;
mod fixture;
mod metrics;
mod review;
mod stats;
mod verify;

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
    match parse_args(&args) {
        Ok(cmd) => println!("{cmd:?}"),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
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
