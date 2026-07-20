# Prompting Standards — the built-in NL catalog

Distilled from the current prompting guidance of **Anthropic**, **OpenAI**, and
**Cursor**, plus community practice. This doc and
`src-tauri/src/rules/nl_catalog.rs` share one source of truth: every catalog id
appears here with its exact instruction string (enforced by a parity test).

Each standard is a checkable property of an *agent instruction file*
(`CLAUDE.md`, `AGENTS.md`, `.cursorrules`, …), phrased so an AI evaluator can
answer "does this file VIOLATE the rule?".

Severity: **Hi** = critical · **Mid** = warning · **Lo** = nit.

## Anthropic

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `anthropic-clarity` | Mid | The file VIOLATES if instructions are vague or ambiguous where a concrete directive is needed (e.g. "be helpful", "handle errors well" with no specifics). | Vague asks produce vague behavior; models follow specifics. |
| `anthropic-examples` | Mid | VIOLATES if non-obvious conventions, formats, or behaviors are described without at least one concrete example. | One example beats three sentences of description. |
| `anthropic-delimit-sections` | Lo | VIOLATES if the file mixes unrelated concerns in one undifferentiated block with no headings, tags, or delimiters separating sections. | Structure tells the model what belongs together. |
| `anthropic-data-vs-instructions` | Mid | VIOLATES if variable or contextual data is tangled directly into directives instead of being clearly marked as data. | Unmarked data gets treated as instruction, and vice versa. |
| `anthropic-allow-idk` | Hi | VIOLATES if the file asks the agent to produce facts, APIs, file paths, or commands but never tells it to admit uncertainty or avoid inventing details. | The #1 defense against hallucinated paths and APIs. |
| `anthropic-positive-framing` | Lo | VIOLATES if guidance is expressed almost entirely as prohibitions ("don't…") without stating the desired behavior to do instead. | Models steer better toward stated targets than away from bans. |
| `anthropic-context-placement` | Lo | VIOLATES if long reference material or background is placed in the middle of actionable instructions rather than grouped at the end or in its own section. | Mid-stream reference dilutes the directives around it. |

## OpenAI

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `openai-identity` | Mid | VIOLATES if the file never states the agent's purpose, role, or the project it serves. | Identity anchors every downstream decision. |
| `openai-dos-and-donts` | Mid | VIOLATES if behavioral rules are stated only abstractly without explicit dos and don'ts the agent can follow. | Abstract values don't constrain concrete actions. |
| `openai-example-consistency` | Lo | VIOLATES if examples in the file use inconsistent formatting or contradict each other. | Contradictory examples train contradictory behavior. |
| `openai-structure` | Lo | VIOLATES if the file lacks any markdown headers or hierarchy and is hard to scan for distinct topics. | Both humans and models navigate by structure. |
| `openai-explicitness` | Hi | VIOLATES if the file relies on the agent inferring critical requirements (stack, commands, constraints) that are never stated outright. | What isn't stated will be guessed — sometimes wrong. |
| `openai-context-early` | Lo | VIOLATES if static, reusable context (project facts, conventions) is buried at the end after volatile task detail rather than established up front. | Stable facts up front frame everything after them. |
| `openai-agentic-planning` | Lo | VIOLATES if the file describes multi-step tasks without guiding the agent to plan or decompose before acting. | Unplanned multi-step work drifts and stalls. |
| `openai-persistence` | Mid | VIOLATES if the file asks the agent to complete tasks but permits stopping early without finishing or verifying the work. | Agents stop at the first plausible answer unless told not to. |

## Cursor

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `cursor-scoped` | Mid | VIOLATES if the file is bloated with rambling or tangential content rather than concise, scoped instructions. | Every wasted token crowds out code context. |
| `cursor-specific-refs` | Lo | VIOLATES if it points to "the relevant files" or "the config" vaguely instead of naming specific files or paths. | Named paths are actionable; "the config" is a guess. |
| `cursor-declare-conventions` | Mid | VIOLATES if the project's stack, build/test commands, or core conventions are never declared. | The first thing an agent needs is how to build and test. |
| `cursor-one-concern` | Lo | VIOLATES if a single section tries to govern many unrelated concerns that should be split. | Mixed sections are half-read and half-applied. |
| `cursor-no-stale-blanket` | Lo | VIOLATES if it contains always-apply guidance that is over-broad, outdated, or no longer matches the described project. | Stale blanket rules teach the agent to distrust the file. |
| `cursor-code-style-examples` | Lo | VIOLATES if it mandates a code style without showing a concrete example of compliant code. | Style is imitated from examples, not adjectives. |

## Karpathy / community

| Id | Sev | Instruction | Why it matters |
|---|---|---|---|
| `community-success-criteria` | Mid | VIOLATES if tasks are described without any definition of done or success criteria. | Without "done", agents under- or over-shoot. |
| `community-no-dead-context` | Lo | VIOLATES if it includes reference content that is never connected to any instruction or used by any task. | Dead context costs tokens and buys nothing. |
| `community-single-source` | Mid | VIOLATES if the same topic is governed by guidance scattered across multiple places that could drift out of sync. | Duplicated guidance always eventually contradicts itself. |
| `community-concrete-over-abstract` | Lo | VIOLATES if key guidance stays abstract where a concrete rule, value, or example is clearly needed. | Concrete rules are checkable; abstractions are vibes. |
