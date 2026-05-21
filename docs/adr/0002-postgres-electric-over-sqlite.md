# Postgres + ElectricSQL + TanStack DB over SQLite

## Status

accepted

## Context & Decision

Content Manager is a single-user, local-only tool, so SQLite is the obvious
default: a file, zero infra. Instead we use **Postgres** as the source of truth
(queried with pure SQL via `pg`, no ORM), **ElectricSQL** to sync it, and
**TanStack DB** Electric Collections on the client.

The driver is the triage UX. Fetch + score runs score Items in a sweep
(`WHERE score IS NULL` — see [ADR-0001](0001-triage-state-machine.md)), and we
want Scores to **stream into the feed live** as Haiku computes them, rather than
the user polling or refetching. ElectricSQL syncs Postgres tables to the client as
shapes, and TanStack DB turns those into reactive collections with live queries and
optimistic triage mutations. SQLite has no comparable first-class sync path to a
reactive client store, and Electric syncs from Postgres specifically.

## Considered Options

- **SQLite + request/response** — simplest, no extra service, but no live feed; the
  dashboard would poll or refetch after each fetch/score/triage.
- **Postgres + TanStack DB Query Collections** (TanStack Query → server functions) —
  keeps Postgres, drops the Electric service, but still can't stream Scores live.
- **Postgres + ElectricSQL + TanStack DB** (chosen) — live-syncing feed at the cost
  of running a second service.

## Consequences

- Local runtime is no longer a single file: `docker compose up` runs **postgres +
  electric** containers alongside the app (see [tech-stack.md](../tech-stack.md)).
  The tool stays local-only and offline-capable, but is no longer zero-infra.
- The app must still run locally regardless, because it reads the Voice from and
  writes Drafts into the local Obsidian vault filesystem.
- Schema is owned by **dbmate** (plain SQL migrations), since there is no ORM.
- Reversing this later (e.g. dropping to SQLite) would mean replacing both the sync
  layer and the client data layer — hence recording the decision here.
