---
title: "The 7 defects that quietly poison your agent's context"
description: "Your CLAUDE.md is read on every single agent run. These are the seven most common ways it silently makes your agent slower, dumber, and more expensive."
pubDate: 2026-07-16
tags: ["prompt-files", "craft"]
---

Every time your coding agent starts a task, it reads your instruction files first: `CLAUDE.md`, `AGENTS.md`, `.cursorrules`. That text is load-bearing: it shapes every decision the agent makes, on every run, in every repo where it exists.

And almost nobody reviews it. It gets appended to in a hurry, copied between projects, and left to rot. Here are the seven defects we see most often. Each one maps to a standard in our 25-standard catalog, with the source it's distilled from.

## 1. Contradictory instructions

"Always write tests first." Forty lines later: "Don't add tests unless asked." Both landed in the file months apart, and now the agent has to guess which one you mean, so it guesses differently on different runs. Contradictions are the worst defect class because they don't degrade output consistently; they make it *random*. Anthropic's guidance is blunt about this: models follow instructions literally, and conflicting rules produce unstable behavior.

**Check:** read your file end-to-end and ask, for each rule, "does anything else in here disagree?"

## 2. Stale or hard-coded model names

"Use gpt-4-32k for summarization." That model doesn't exist anymore, but your prompt still insists on it. Hard-coded model names, versions, and API shapes rot faster than any other content in a prompt file. When the reference goes stale, the agent either errors, silently substitutes, or, worse, treats the whole file as less trustworthy context.

**Check:** grep your prompt files for model identifiers and dates. If it can go out of date, it needs an owner or it needs to go.

## 3. Missing examples

You describe the output you want in prose, and the agent gives you something adjacent to it. One good example beats three paragraphs of description. Few-shot examples are the single most reliable way to pin down format and tone, and both Anthropic and OpenAI put examples near the top of their prompting guidance. This is also the defect we chose for our first controlled benchmark run, precisely because it's so common. [Early numbers here](/blog/what-a-bad-prompt-actually-costs).

**Check:** for every "the output should…" sentence, ask whether an example would say it better. It usually does.

## 4. Walls of text

A 400-line CLAUDE.md with no headings is not documentation, it's sediment. Models handle structure well and unstructured sprawl badly; important rules buried in paragraph twelve compete with trivia for the agent's attention. Karpathy's framing is useful here: context is a scarce resource, so spend it like money.

**Check:** if you can't find a rule in five seconds by scanning headings, neither can your agent.

## 5. No role or persona

Files that jump straight into micro-rules ("use 2-space indent") without ever saying what the agent *is* (senior engineer on this codebase? careful reviewer?) lose a cheap, powerful lever. A one-line role sets defaults for hundreds of small decisions you didn't think to specify.

**Check:** does the first paragraph tell the agent who it is and what good work looks like here?

## 6. Unspecified output format

"Summarize the changes": as prose? bullets? a commit message? a table? When the format is unspecified, the agent picks one, and you pay a review round-trip to fix it. OpenAI's guidance treats explicit output contracts as table stakes for reliable automation.

**Check:** every task your file describes should say what the deliverable looks like.

## 7. Instructions that drifted from reality

The file says "run `make test`" but the project moved to `pnpm test` a year ago. It references directories that were renamed, services that were decommissioned, conventions the team abandoned. Repo drift is invisible until an agent takes the instruction literally. And it will.

**Check:** do the commands and paths in your prompt file still exist? (This is exactly the class of thing a deterministic scanner is better at than you are.)

---

## The uncomfortable part

None of these defects announce themselves. Your agent doesn't error. It just quietly burns more tokens, takes more turns, and produces work that needs more review. That's why we built [Prompt Janitor](/): it scans every prompt file on your Mac, grades each one A–F against these standards (source-cited, deterministic, free), and, if you want, rewrites the weak parts.
