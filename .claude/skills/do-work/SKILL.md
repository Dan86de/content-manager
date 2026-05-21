---
name: do-work
description: Drive a single unit of work in the content-manager repo from plan to commit — plan in plan mode, implement, run the full test suite and Biome checks, then propose a commit. Use when the user asks to implement a feature, fix a bug, or make any code change in this repo, or invokes /implement-task.
---

# Implement Task

Take one piece of work from idea to a proposed commit. Run the four phases in
order; do not skip ahead.

## 1. Plan

- Read the docs that bear on the task. Start with [AGENTS.md](../../../AGENTS.md)'s
  "Start here" table and follow it to [CONTEXT.md](../../../CONTEXT.md),
  [docs/tech-stack.md](../../../docs/tech-stack.md), and any relevant ADR.
- Use the **domain language** from CONTEXT.md (Item, Source, Niche, Score,
  Triage, Draft, Voice, Enrichment) and respect the _Avoid_ notes.
- Enter **plan mode**, write a concise plan, and get the user's approval before
  writing any code. Sacrifice grammar for concision; end with unresolved
  questions if any.

## 2. Implement

- Follow the [tech-stack decisions](../../../docs/tech-stack.md): pure SQL via
  `pg` (no ORM), dbmate migrations, TanStack AI, pnpm, Vitest, Biome.
- Respect the triage invariants in
  [ADR-0001](../../../docs/adr/0001-triage-state-machine.md).
- If a decision changes, update the relevant doc (or add an ADR) in the same
  change.

## 3. Test & check format

Run all of these and make them pass before proposing a commit:

```bash
pnpm typecheck   # tsc --noEmit
pnpm test        # full vitest suite
pnpm check:fix   # biome: format + lint + organize imports (writes fixes)
pnpm check       # confirm clean
```

If anything fails, fix it and re-run — do not move on with a red suite or
unformatted code.

## 4. Propose commit

- Summarize what changed and why.
- Draft a commit message in the **domain language** (an Item is never a "post").
- If on `main` stay on main, if user wants propose a new branch prefixed `dan86de/`.
- **Wait for explicit approval** before running `git commit`. Do not push unless
  asked.
