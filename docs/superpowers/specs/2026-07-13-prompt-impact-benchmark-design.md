# Prompt Impact Benchmark — Design Spec

- **Date:** 2026-07-13
- **Status:** Approved (design), ready for implementation planning
- **Owner:** Ahmed ABOUELLEIL
- **Branch:** `feat/impact-benchmark`
- **Related:** `2026-06-04-prompt-janitor-design.md` (core), `2026-07-09-data-viz-epic-design.md` (analytics surface this extends)

---

## 1. Why

Prompt Janitor grades prompt files A–F. A grade is abstract — nobody *feels* "6/10." The offer only becomes irresistible when the tool shouts the pain in the user's own currency:

> "Your `CLAUDE.md` has 4 defects. In our controlled benchmark, those exact defects cost on average **+340k tokens** and **~2× turns** per task."

To say that credibly we need **evidence**, and the only kind skeptics can't wave away is a **controlled, causal benchmark**: run the same task through an agent with a defect present vs absent, and measure the delta.

This benchmark is also a strategic asset beyond sales: it is a **proprietary dataset on what actually makes prompts work** — a content engine and a moat. And it holds the rubric honest: a rule the data can't defend gets demoted or cut.

## 2. Scope

**In scope (this spec):**
- An offline, rule-indexed benchmark harness that measures the cost of each prompt defect.
- A versioned effect-size artifact (`effects.json`) shipped with the app.
- A free, zero-API-cost personalized "impact letter" derived from detected-defects × effect table.
- A premium, opt-in live A/B (current file vs autofixed file) producing a real before/after receipt.
- Analytics integration: impact metrics tracked over time alongside grade history.

**Explicitly out of scope (roadmap, separate specs):**
- Chat-history / session-transcript ingestion (the "observed telemetry" engine).
- In-app AI-assisted prompt authoring/editing.
- Community rules, template auto-update pipeline, pricing/lifetime-deal changes.

**Non-goals as constraints:**
- **Honesty gate:** only statistically significant effects feed the user-facing letter. A non-significant rule is shown as "no measured impact" and becomes a candidate for demotion/removal. The benchmark validates the rubric; it does not rubber-stamp it.

## 3. Architecture — three tiers

```
OFFLINE — run by owner, periodically (the science)
  rule-indexed suite × N runs × {defect present / absent}
        │  headless `claude -p`, pinned model + CC version + temperature
        ▼
  aggregate (mean + 95% CI + significance)
        ▼
  effects.json  (versioned; ships with app)
        │
        ├──────────────► FREE, in-app, instant, $0
        │     detected defects (already computed today) × effects.json
        │     → personalized impact letter, zero API calls
        │
        ├──────────────► PREMIUM, opt-in, real $ / minutes
        │     live A/B: current file vs autofixed file on the same suite
        │     → real measured before/after receipt (also the landing hero)
        │
        └──────────────► ANALYTICS
              estimated waste over time, waste eliminated by fixes,
              re-scores tied to suite_version bumps
```

Independent variable = the `CLAUDE.md` / `.cursorrules` content (defect present vs absent; or user's current vs autofixed). Dependent variables = tokens, turns, pass/fail, tool/subagent usage, wall-clock.

## 4. Task suite — fixtures indexed to rules

Each detector is an unproven claim ("this defect makes the agent perform worse"). Each fixture exists to prove or refute one claim. A fixture is:

```
benchmark/fixtures/<rule>/
  repo/            # throwaway project the task runs against
  task.md          # the identical task prompt for both conditions
  claude.bad.md    # CLAUDE.md WITH the defect
  claude.good.md   # CLAUDE.md WITHOUT the defect (only difference)
  verify.sh        # deterministic verifier → exit 0 = pass
  meta.json        # rule id, what the defect should cost, notes
```

**Invariant:** the *only* difference between the two conditions is the defect under test. If a fixture can't isolate one defect cleanly, it does not ship — the rule is labeled "not yet benchmarked," honestly.

**v1 = the headline 5** most demo-able defects (biggest, most obvious cost). Harness and schema are built to grow to the full ~20. Candidate headline 5:

| Rule | Fixture task | How the defect bites | Verifier |
|---|---|---|---|
| `package_manager_mismatch` | install deps + add a script (repo uses pnpm) | prompt says npm → wrong lockfile, retries | install succeeds + `pnpm-lock.yaml` touched |
| `missing_output_format` | "return result as JSON matching schema X" | no format → agent guesses → correction turns | output parses against schema |
| `contradiction` | task under two conflicting rules | agent flip-flops | tests green + turn count |
| `token_budget` | any task, bloated ~8k-token file | +input tokens every turn | tests green; measure tokens |
| `missing_role` | task needing domain framing | agent under-specifies → rework | tests green + turn count |

(Final headline 5 confirmed during implementation as fixtures are authored.)

## 5. Runner

- Standalone Rust binary `benchmark-runner` (NOT linked into the app binary; the app never shells out to Claude during normal use).
- Drives `claude -p --output-format json` per condition.
- **Pinned for reproducibility:** model id, Claude Code version, temperature — all recorded in output.
- Captures per run: input/output tokens, num turns, full tool-call log (→ subagent/capability usage), verifier pass/fail, wall-clock.
- N ≈ 20–30 runs per condition offline (affordable because it runs once); small N for the live premium tier, labeled "indicative."

## 6. Effect-size table — `effects.json`

Per rule:
```json
{
  "rule": "token_budget",
  "n": 30,
  "delta_tokens":   { "mean": 41200, "ci95": [33800, 48600] },
  "delta_turns":    { "mean": 1.8,   "ci95": [1.1, 2.5] },
  "delta_pass_rate": -0.12,
  "delta_tool_usage": { "subagent": -0.4 },
  "significant": true,
  "suite_version": "2026-07-13.1"
}
```

Rules:
- Only `significant: true` effects feed the user letter. Others render as "no measured impact."
- **Composition is not a naive sum** — defects interact. v1 reports each defect's effect individually plus a deliberately *conservative* combined range, flagged as an estimate. Calibrating interaction via combined-defect fixtures is explicit v2 work.
- `suite_version` bumps on every re-benchmark; consumers (letter, analytics) key off it so a re-run is a visible, traceable event.

## 7. Free personal impact letter

Pure lookup, no API cost. For a scanned file: detected defects (already computed) ⋈ `effects.json` → composed estimate. Rendered on Detail/Overview and fed into the existing `VerdictHero`. Shows total projected waste, per-defect breakdown, and the biggest offender. This is the everyday value — the thing that makes the grade *hurt*.

New components (per one-responsibility convention):
```
src-tauri/src/impact.rs          # load effects.json, compose per-file estimate
src/components/ImpactLetter/      # index.ts, ImpactLetter.tsx, .types.ts, .constants.ts
```

## 8. Premium live A/B receipt

Opt-in, real tokens/time. Runs the suite with the user's current file vs the autofixed file, small N, produces a shareable before/after receipt with real measured numbers. Doubles as: (a) a premium in-app feature, (b) the landing-page hero asset when run once on a generic bad-vs-good file.

```
src/components/BeforeAfter/       # index.ts, BeforeAfter.tsx, .types.ts, .constants.ts
```

## 9. Analytics integration

The Analytics screen and `get_analytics` rollup (grade history today) gain an impact dimension:
- Estimated waste (tokens/turns) over time.
- Waste eliminated by applied fixes.
- Re-score events tied to `suite_version` bumps (so a benchmark refresh is a marker on the trend, not a silent overwrite).

Extends the existing data-viz epic surface rather than adding a new screen.

## 10. Module layout

```
benchmark/                         # offline harness — not in app binary
  fixtures/<rule>/{repo/, task.md, claude.bad.md, claude.good.md, verify.sh, meta.json}
  runner/                          # Rust bin: drive `claude -p`, collect metrics
  aggregate/                       # stats → effects.json (mean, CI, significance)
  effects.json                     # versioned artifact, copied into app resources
src-tauri/src/impact.rs            # per-file estimate from effects.json
src/components/ImpactLetter/       # free letter UI
src/components/BeforeAfter/        # premium live A/B receipt UI
# get_analytics rollup + Analytics screen extended for impact dimension
```

## 11. Risks & open questions

- **Fixture isolation** — the defect must be the *only* variable or the number is junk. Mitigation: verifier + manual review + `meta.json` rationale per fixture.
- **Stochastic noise** — mitigated by N + 95% CI + significance gate; small-N live tier labeled "indicative."
- **Effect additivity** — conservative combined estimate in v1; combined-defect calibration is v2.
- **Rules may not survive the data** — expected and healthy; be ready to demote/cut, traceable to a suite version.
- **Cost of offline runs** — bounded (headline 5 × 2 conditions × N ≈ 300 runs per refresh); acceptable, and it runs on the owner's dime, not per user.
- **Open:** final headline-5 selection; exact significance test (e.g. Welch's t / bootstrap CI) — decided in implementation.

## 12. Sequencing (phases → issues, per ship workflow)

1. Harness skeleton: `benchmark-runner` + one fixture end-to-end, metrics captured.
2. Aggregation → `effects.json` schema + significance gate.
3. Author the headline-5 fixtures; produce the first real `effects.json`.
4. `impact.rs` + `ImpactLetter` (free letter wired to real data).
5. Analytics impact dimension.
6. `BeforeAfter` premium live A/B + landing-page hero run.
