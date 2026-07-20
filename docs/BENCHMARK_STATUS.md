# Impact Benchmark — Status & Roadmap

_Last updated: 2026-07-16_

## Where we are

**Plan 1 of 4 (the harness) is complete and live-validated.** PR #98 is open
(`feat/impact-benchmark` → `feat/data-viz-epic`), mergeable, awaiting review
alongside PRs #89–97.

- All 10 tasks of `docs/superpowers/plans/2026-07-14-impact-benchmark-harness.md` are done.
- The pipeline runs end-to-end with a real Claude agent + reviewer. Live-run fixes
  already absorbed: headless edit permissions (`--dangerously-skip-permissions`),
  reliable JSON judge output, prompt-cache token counting, orchestrator-owned work dir.
- First validated `benchmark/effects.json` produced (suite `2026-07-14.3-smoke`).

## First results (smoke run — N=5, Haiku, rule `encourage-examples`)

| Metric | Defective vs fixed prompt |
|---|---|
| Δ tokens | **+36.8k** mean, CI95 [−24.7k, +98.5k] |
| Δ turns | **+0.8** mean, CI95 [−1.4, +3.0] |
| Δ review burden | **−0.4 major** issues on the fixed prompt |
| Significant | **No** — CIs span zero (expected at N=5) |

Direction is encouraging; sample is too small to claim anything. Only
significant effects (CI excluding 0) will feed the user-facing letter.

## What's coming (dev — paused pending traction)

1. **Powered run** — more iterations (and likely a stronger model than Haiku)
   so CIs exclude zero.
2. **4 more fixtures** — only `missing_few_shot` is authored; each headline-5
   rule needs one (repeats of Task 9's shape in the plan doc).
3. **Plan 2** — free impact letter (`impact.rs` + `ImpactLetter`), joins on
   `Rule::id()` strings, consumes `effects.json`.
4. **Plan 3** — analytics impact dimension.
5. **Plan 4** — premium live A/B (`BeforeAfter`).

## Strategic gate (decided 2026-07-16)

Before committing harder on dev, **spin out marketing** to let the public judge
the idea:

- Update landing page with new structure / features / philosophy.
- Hook Resend email (waitlist capture).
- Add Google Analytics.
- Publish a few blog articles teaching prompt / AI / skills topics that matter.
- Ship a proper pre-launch website.
- Post on socials, measure traction → **only then** resume Plans 2–4 and the
  powered benchmark run.
