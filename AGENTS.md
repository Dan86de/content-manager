# Content Manager — Agent Guide

A single-user, local-only tool that fetches items from curated sources, scores
them against a personal niche, and turns chosen items into voice-matched content
drafts in an Obsidian vault.

## Start here

Before working on a task, read the docs that bear on it:

| Doc | What it covers | Read it when |
| --- | --- | --- |
| [CONTEXT.md](CONTEXT.md) | Domain language (Item, Source, Niche, Score, Triage, Draft, Voice, Enrichment), relationships, and the triage workflow | Always — it defines the vocabulary to use in code and conversation |
| [docs/tech-stack.md](docs/tech-stack.md) | The chosen stack (TanStack Start, Postgres + `pg`, ElectricSQL, TanStack DB, TanStack AI/Anthropic, pnpm, Vitest, Biome) with rationale and rejected alternatives | Picking a library, scaffolding, or wiring data/LLM flow |
| [docs/adr/0001-triage-state-machine.md](docs/adr/0001-triage-state-machine.md) | The `new → kept → drafted` / `dismissed` state machine and the `score IS NULL` resumable marker | Touching triage, scoring sweeps, or status transitions |
| [docs/adr/0002-postgres-electric-over-sqlite.md](docs/adr/0002-postgres-electric-over-sqlite.md) | Why Postgres + Electric + TanStack DB instead of SQLite | Questioning the storage/sync layer |
| [niche.md](niche.md) | The relevance spec injected into the scoring prompt | Working on scoring, or changing what counts as relevant |

## Conventions

- **Use the domain language from [CONTEXT.md](CONTEXT.md)** in code, comments, and
  commit messages. Mind the _Avoid_ notes (e.g. an Item is never a "post"; a
  "feed" is the dashboard list, not a Source).
- **Follow the tech-stack decisions** in [docs/tech-stack.md](docs/tech-stack.md)
  rather than reaching for a default. Notably: pure SQL via `pg` (no ORM), dbmate
  for migrations, TanStack AI (not the raw Anthropic SDK), pnpm, Vitest, Biome.
- **Respect the triage invariants** in
  [ADR-0001](docs/adr/0001-triage-state-machine.md): Keep is mandatory before
  Draft; `dismissed` and `drafted` are terminal; the scoring step sweeps all
  `score IS NULL` Items, not just a single fetch's rows.
- **When a decision changes**, update the relevant doc (and add an ADR under
  `docs/adr/` for architectural choices) in the same change.
