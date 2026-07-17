---
title: "We measured what a bad prompt actually costs"
description: "Everyone says bad prompts waste money. We built a controlled benchmark to find out how much — same task, same agent, one defect apart. Here are the first honest numbers."
pubDate: 2026-07-16
tags: ["benchmark", "evidence"]
---

"Bad prompts cost you money" is the kind of claim everyone nods at and nobody measures. We're building a prompt-health tool, so we don't get to hand-wave — if we say a defect matters, we should be able to show what it costs. So we built a benchmark harness and started measuring.

This post explains the methodology and shares our first numbers — including the caveats most marketing pages would leave out.

## The setup

The core idea is a **controlled pair**: two versions of the same project fixture that are identical in every way — same code, same task, same agent — except the prompt file differs by exactly **one defect**. One version's `CLAUDE.md` has the defect; the other has the fix. Any difference in outcome is attributable to that one change.

For each side of the pair, the harness:

1. Spawns a fresh headless coding agent (Claude Code) on a copy of the fixture and gives it the same task.
2. Records **tokens** (including cache reads — they're billed too), **agent turns**, and whether a **deterministic verifier** (a script, not a model) accepts the result.
3. Sends the produced diff to a separate reviewer model that counts **review burden**: how many major/minor issues a reviewer would flag.

We repeat that N times per side, then compute the delta with a bootstrap 95% confidence interval. An effect only counts as *significant* if the interval excludes zero. No cherry-picking: the harness writes every run to a versioned `effects.json`, and the significance flag is computed, not asserted.

## First numbers (read the caveat)

Our first validated run targeted one defect — a prompt file **missing few-shot examples** — with N=5 runs per side on a small model:

- **Tokens:** the defective prompt cost **+36.8k tokens per task** on average (95% CI: −24.7k to +98.5k)
- **Turns:** **+0.8 extra agent turns** on average (95% CI: −1.4 to +3.0)
- **Review burden:** the fixed prompt drew **0.4 fewer major review issues** per run

**The caveat, in bold, above the fold: none of this is statistically significant yet.** Both confidence intervals span zero. N=5 is a smoke test — it validates that the harness works end-to-end, not that the effect is proven. The direction is encouraging and consistent across metrics, but if we stopped here and put "+36k tokens!" on a billboard, we'd be doing the thing we built this benchmark to avoid.

## What would make it significant

Statistical power. The variance between agent runs is large (that's the honest reason most people don't benchmark prompts — single anecdotes are noise). Next steps, in order:

1. **More iterations per pair** until the confidence intervals tighten enough to exclude zero — or to show the effect isn't real. We'll publish either result.
2. **Four more defect fixtures**, one per headline rule (contradictory instructions, stale model names, missing structure, unspecified output format), so the benchmark covers the defects we flag most.
3. **A stronger agent model** for the powered run, closer to what people actually use day-to-day.

Everything ships versioned: model, agent version, temperature, and suite version are stamped into the results file, so a number is never quoted without its provenance.

## Why a prompt-linting company publishes its own null results

Because the alternative is worse. Prompt advice today is almost entirely vibes — screenshots, threads, "this one trick". If we want "your prompt file has a defect" to mean something, the claim has to be falsifiable, and we have to accept the risk that some defects turn out not to matter. Those rules should get demoted. That's the deal.

[Prompt Janitor](/) grades your prompt files against these standards today — deterministically, source-cited, free, on your machine. The benchmark is how we earn the right to say the grades matter.
