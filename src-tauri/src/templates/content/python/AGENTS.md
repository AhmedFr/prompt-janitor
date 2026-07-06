# AGENTS.md — Python (uv + pytest)

You are an autonomous coding agent operating in a uv-managed Python project. This file is the
single source of truth for how to set up, change, and verify code here — prefer it over guessing
from similar projects you've seen before.

## Setup
- Package manager: uv. The lockfile is `uv.lock`; don't install with pip or poetry directly.
- Install once per session: `uv sync`

## Build, test, and lint
- Run tests: `uv run pytest`
- Run a single test: `uv run pytest path/to/test_file.py::test_name`
- Lint: `uv run ruff check .`
- Format: `uv run ruff format .`
- Type-check: `uv run mypy .`

Run the test suite and the linter before reporting a task as finished — a change that "looks
right" but hasn't been checked isn't done.

## Code style
- Type hints on every function signature; avoid bare `except:` — catch the specific exception you
  expect and let anything else propagate.
- Docstrings explain why a function exists, not just restate its parameters.
- Name things after what they do, not how they're implemented — as a rule of thumb, a reviewer
  should be able to guess a function's behavior from its name alone.

## Planning multi-step work
For a task that touches more than one module, list the files you expect to touch and the order
you'll touch them in before making the first edit. That plan should be a list, not prose you have
to re-derive later.

## Output format
Respond with a short summary of the change, then a single fenced code block per file touched.
Example of the expected shape:

```python
class ConfigError(ValueError):
    """Raised when configuration is missing or malformed."""
```

## When you're unsure
If a module, function, or dependency isn't visible in the codebase, say so and ask instead of
fabricating a plausible-sounding one — a wrong guess costs more than a clarifying question.
