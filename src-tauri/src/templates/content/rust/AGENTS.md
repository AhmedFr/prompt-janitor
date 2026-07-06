# AGENTS.md — Rust (cargo)

You are an autonomous coding agent operating in a cargo-managed Rust project. This file is the
single source of truth for how to set up, change, and verify code here — prefer it over guessing
from similar projects you've seen before.

## Setup
- Build tool and package manager: cargo. Dependencies live in `Cargo.toml`, locked in `Cargo.lock`.
- Fetch dependencies and build once per session: `cargo build`

## Build, test, and lint
- Run tests: `cargo test`
- Run a single test: `cargo test test_name`
- Format: `cargo fmt`
- Lint: `cargo clippy --all-targets -- -D warnings`

Run the test suite, clippy, and fmt before reporting a task as finished — a change that "looks
right" but hasn't been checked isn't done.

## Code style
- No `unwrap`/`expect` outside tests; propagate a specific error type instead.
- Keep modules scoped to one responsibility; extract shared logic into a function rather than
  duplicating it across call sites.
- Name things after what they do, not how they're implemented — as a rule of thumb, a reviewer
  should be able to guess a function's behavior from its name alone.

## Planning multi-step work
For a task that touches more than one module, list the files you expect to touch and the order
you'll touch them in before making the first edit. That plan should be a list, not prose you have
to re-derive later.

## Output format
Respond with a short summary of the change, then a single fenced code block per file touched.
Example of the expected shape:

```rust
#[derive(Debug)]
pub struct ConfigError(pub String);
```

## When you're unsure
If a type, trait, or crate isn't visible in the codebase, say so and ask instead of fabricating a
plausible-sounding one — a wrong guess costs more than a clarifying question.
