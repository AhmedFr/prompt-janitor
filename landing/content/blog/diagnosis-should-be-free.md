---
title: "Diagnosis should be free"
description: "Prompt files are infrastructure nobody inspects. Our manifesto: knowing how healthy your prompts are should cost nothing. Fixing them is what you pay for."
pubDate: 2026-07-16
tags: ["philosophy"]
---

There's a category of file on your machine that gets read more often than any documentation you've ever written, shapes more decisions than your linter config, and receives less review than a typo fix: your prompt files. `CLAUDE.md`. `AGENTS.md`. `.cursorrules`.

Every agent run starts by reading them. They are, functionally, infrastructure, and they're managed like sticky notes.

## The strange gap

For every other kind of load-bearing text in a codebase, we built inspection layers years ago. Code gets linters, type checkers, CI, review. Dependencies get audit tools and version pins. Even commit messages get hooks.

Prompt files get nothing. No grade, no diff review culture, no drift detection. They accumulate by appendix: someone hits a problem, adds a rule, moves on. Six months later the file contradicts itself, references commands that no longer exist, and quietly taxes every single agent run. Nobody notices, because the failure mode isn't a crash. It's an agent that's a little slower, a little dumber, and a little more expensive, forever.

We built Prompt Janitor because we kept paying that tax ourselves.

## Why diagnosis is free, actually free

Prompt Janitor's scanner runs on your Mac, grades every prompt file A–F against source-cited standards, rescans on a schedule, tracks history, and alerts you when a grade slips. All of that is free. Not trial-free, not "5 scans a month" free, not "findings blurred until you pay" free. Free, with no scan caps, forever. Even the 25-standard AI-powered catalog evaluation is free when you bring your own compute: a local Ollama model or your own API key.

This isn't generosity; it's a position:

**You can't charge someone to find out whether they have a problem.** A diagnostic tool that hides its findings behind a paywall has an incentive to make everything look sick. The only way grades stay honest is if the grade costs nothing and we make money elsewhere.

**Visibility should be universal, because the problem is universal.** Every person with a prompt file benefits from knowing its health, including the majority who will never pay us. That's fine. That's how infrastructure tooling should work.

**The benchmark keeps us honest.** We're [measuring what prompt defects actually cost](/blog/what-a-bad-prompt-actually-costs) with controlled experiments, and publishing methodology, confidence intervals, and null results alike. If a rule doesn't demonstrably matter, it gets demoted, and free users get the same standards updates as paying ones.

## What you pay for: treatment

Diagnosis tells you the file is a D. Treatment is the work of making it an A, and that's Pro: AI rewrites of the weak parts, one-click apply with backup and undo, your own standards enforced in plain English, starter templates per stack. A one-time $19 purchase at launch ($30 afterwards; pricing isn't final yet), perpetual license, no subscription. If your prompt health doesn't rise a full letter grade in 30 days, full refund.

Free tells you the truth. Pro fixes it. We think that's the only honest way to build this category.

---

Prompt Janitor is launching soon on macOS. The scanner (the whole diagnosis layer) will be free from day one.
