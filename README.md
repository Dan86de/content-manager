# Content Manager

A single-user, local-only tool that fetches Items from curated Sources, Scores them
against a personal Niche, and turns chosen Items into voice-matched Drafts in an
Obsidian vault.

## Prerequisites

- Node 22
- [pnpm](https://pnpm.io/)
- Docker (for the local Postgres + Electric infra)
- [dbmate](https://github.com/amacneil/dbmate) — `brew install dbmate`

## Setup

```bash
cp .env.example .env          # fill in API keys + OBSIDIAN_VAULT_PATH
docker compose up -d          # Postgres on :5432 (wal_level=logical) + Electric on :3001
dbmate up                     # apply migrations in db/migrations
pnpm install
pnpm dev                      # app on :3000
```

## Testing

```bash
pnpm test
```

The Postgres-backed repository test only runs when `TEST_DATABASE_URL` is set
(it points at `content_manager_test`) and Postgres is up. It's already in
`.env` if you copied `.env.example`, and Vitest loads `.env` automatically;
Vitest's `globalSetup` then runs `dbmate` to create and migrate that database
before the suite. Without it (e.g. in CI), the repository test is skipped.

## Checks

```bash
pnpm typecheck    # tsc --noEmit
pnpm check        # biome check
```

## Deeper context

- [AGENTS.md](AGENTS.md) — agent guide and conventions
- [CONTEXT.md](CONTEXT.md) — domain language and the triage workflow
- [docs/tech-stack.md](docs/tech-stack.md) — the chosen stack and rationale
- [docs/adr/0001-triage-state-machine.md](docs/adr/0001-triage-state-machine.md) — `new → kept → drafted` / `dismissed`
- [docs/adr/0002-postgres-electric-over-sqlite.md](docs/adr/0002-postgres-electric-over-sqlite.md) — Postgres + Electric over SQLite
