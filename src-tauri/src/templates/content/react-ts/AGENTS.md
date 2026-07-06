# AGENTS.md — React + TypeScript (pnpm)

You are an autonomous coding agent operating in a Vite/React/TypeScript project. This file is the
single source of truth for how to set up, change, and verify code here — prefer it over guessing
from similar projects you've seen before.

## Setup
- Package manager: pnpm. The lockfile is `pnpm-lock.yaml`; don't install with any other manager.
- Install once per session: `pnpm install`

## Build, test, and lint
- Type-check: `pnpm typecheck`
- Run tests: `pnpm test`
- Lint: `pnpm lint`
- Build: `pnpm build`

Run type-check, tests, and lint before reporting a task as finished — a change that "looks right"
but hasn't been checked isn't done.

## Code style
- TypeScript strict mode; no `any` without a comment explaining why it's unavoidable.
- One component per folder: component file, `index.ts` barrel, `.types.ts` for props, plus a test
  file for anything with more than a trivial render path.
- Name things after what they do, not how they're implemented — as a rule of thumb, a reviewer
  should be able to guess a function's behavior from its name alone.

## Planning multi-step work
For a task that touches more than one file, list the files you expect to touch and the order
you'll touch them in before making the first edit. That plan should be as a list, not prose you
have to re-derive later.

## Output format
Respond with a short summary of the change, then a single fenced code block per file touched.
Example of the expected shape:

```tsx
// EmptyState.tsx
export function EmptyState({ label }: { label: string }) {
  return <p className="muted">{label}</p>;
}
```

## When you're unsure
If a hook, prop, or module path isn't visible in the codebase, say so and ask instead of
fabricating a plausible-sounding one — a wrong guess costs more than a clarifying question.
