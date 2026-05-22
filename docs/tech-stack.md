# Technology Stack Choices

The chosen stack for Content Manager, with rationale and rejected alternatives.
Scope-shaping facts about *what* the tool does live in [CONTEXT.md](../CONTEXT.md);
this doc is only about *how* it's built.

## At a glance

| Layer | Choice |
| --- | --- |
| Language / runtime | TypeScript on Node |
| App framework | TanStack Start (full-stack React) |
| Styling | Tailwind CSS |
| UI components | ui.sh (`/ui` skill, already configured) |
| Database | Postgres |
| DB access (server) | Pure SQL via `pg` — no ORM |
| Migrations | dbmate (plain numbered `.sql` files) |
| Client data / reactivity | TanStack DB |
| Sync | ElectricSQL (Electric Collections → Postgres shapes) |
| LLM SDK | TanStack AI (`@tanstack/ai`, `@tanstack/ai-anthropic`, `@tanstack/ai-react`) |
| Scoring model | Claude Haiku (plain, high-volume call) |
| Drafting model | Claude Opus (agent with TanStack AI tool-calling) |
| Article extraction | `@extractus/article-extractor` |
| Transcript extraction | `youtube-transcript` |
| Frontmatter (Voice / Draft files) | `gray-matter` |
| Config & secrets | env vars via `.env` |
| Local infra | Docker Compose (postgres + electric containers) |
| Package manager | pnpm |
| Tests | Vitest |
| Lint + format | Biome |
| TanStack scaffolding/migration | TanStack CLI + MCP |

## Decisions & rationale

### Runtime — TypeScript / Node
First-class Anthropic + TanStack support, the same stack as the dashboard, and a
natural fit for filesystem + Obsidian-markdown work. Matches the AI-agent-tooling
domain this project lives in.

### App framework — TanStack Start + Tailwind + ui.sh
One full-stack app: React dashboard plus server functions for fetch / score /
triage / draft. Tailwind for styling; components come from ui.sh via the
preconfigured `/ui` skill. Scaffolding and any framework migrations go through the
TanStack CLI + MCP.

### Database — Postgres, pure SQL via `pg`
Postgres is the source of truth, queried with hand-written SQL through `pg` (no
ORM) for full control and zero abstraction over the triage semantics
(`ON CONFLICT DO NOTHING` for immutable Item snapshots, `WHERE score IS NULL`
resume sweeps — see [ADR-0001](adr/0001-triage-state-machine.md)).
Postgres (not SQLite) was chosen so ElectricSQL can sync from it.

### Migrations — dbmate
With no ORM, dbmate owns the schema: plain numbered `.sql` up/down files, runnable
in Docker/CI, keeping SQL pure and explicit.

### Client data + sync — TanStack DB + ElectricSQL
TanStack DB provides reactive client collections, live queries, and optimistic
triage mutations. ElectricSQL Electric Collections sync straight from Postgres via
shapes, so Scores stream into the feed live as they're computed — the deliberate
reason for taking on a sync service rather than plain request/response.

### LLM layer — TanStack AI + Anthropic
TanStack AI (typed streaming + isomorphic tool-calling, native to TanStack Start)
calls Anthropic with an API key. Two tiers:
- **Scoring** — Claude Haiku, plain (non-agentic) calls batched at ~10 Items each
  against `niche.md`; each batch entry carries a stable Item id Haiku must echo,
  and results map back by id, never by array position (high volume, must stay
  cheap/fast).
- **Drafting** — Claude Opus as an agent that pulls its own content via TanStack AI
  tools (`fetch-article`, `get-transcript`) before producing the voice-matched Draft.

### Enrichment tools — article-extractor + youtube-transcript
The drafting agent's tools are backed by `@extractus/article-extractor` (main
article text) and `youtube-transcript` (timedtext transcripts — the YouTube Data
API does not provide these). Lightweight, no extra services.

### Sources (initial) — YouTube Data API v3, keyless HN, keyless RSS
- **YouTube** — Data API v3 (keyed) for richer channel data.
- **HackerNews** — keyless via the Algolia Search API.
- **RSS / newsletter feeds** — keyless RSS reader.

### Fetch trigger — manual now, cron later
A "Fetch now" server function runs fetch → insert → score-sweep on demand.
Scheduled runs come later. The `score IS NULL` marker covers interrupted runs, so
no always-on process is needed yet.

### Local infra — Docker Compose
`docker compose up` runs postgres + electric containers on the local machine
alongside the app. Keeps the tool truly local-only, offline-capable, and zero-cost.
The app itself must run locally regardless, because it reads the Voice from and
writes Drafts into the local Obsidian vault filesystem.

### Tooling — pnpm + Vitest + Biome
pnpm (fast, disk-efficient), Vitest (native to the Vite/TanStack Start toolchain),
Biome (single fast tool for lint + format).

### Markdown & config — gray-matter + .env
`gray-matter` parses frontmatter when reading Voice files and serializes
traceability frontmatter when writing Drafts. Secrets and config
(`ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, vault path, Postgres/Electric URLs) live
in `.env` env vars.

## Rejected alternatives

- **SQLite** — the obvious pick for a single-user local tool, rejected because
  ElectricSQL syncs from Postgres and the live-feed UX was wanted.
- **Drizzle / Prisma ORM** — rejected in favor of pure SQL for control and teachability.
- **Query Collections (TanStack Query → server fns)** — simpler, no sync service,
  rejected because it can't stream Scores in live.
- **Railway / Electric Cloud hosting** — rejected to stay local-only and free;
  `railway` MCP remains available if hosting is wanted later.
- **Plain `@anthropic-ai/sdk`** — rejected in favor of TanStack AI to stay in one
  ecosystem and use its tool-calling for drafting.
- **Enrichment in code (deterministic)** — rejected in favor of agentic tool-calling
  for the drafting step.

## Deferred / future scope

- **Reddit / subreddit** — listed as a Source kind in CONTEXT.md but deferred; not
  in the initial fetch set.
- **Newsletters** and **curated sites** (e.g. claudecodedaily.com) as Source kinds.
- **Scheduled (cron) fetches** in addition to the manual trigger.
