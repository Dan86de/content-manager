# Triage state machine and the `score IS NULL` resumable marker

## Status

accepted

## Context & Decision

Every fetched **Item** carries an explicit triage `status` driving a single linear workflow:

```
new ──Keep──▶ kept ──Draft──▶ drafted   (terminal)
 │             │
 └──Dismiss──▶ │──Dismiss──▶ dismissed  (terminal)
```

- **Keep is mandatory before Draft** — you cannot Draft a `new` Item directly. Draft only acts on a `kept` Item.
- `kept -> dismissed` is the one "changed my mind" escape hatch.
- `dismissed` and `drafted` are terminal: no un-dismiss, no re-draft.
- Separately, `score IS NULL` is the canonical "needs scoring" marker. The scoring step sweeps **all** Items where `score IS NULL` — not just the rows a given fetch inserted — so a fetch interrupted mid-scoring leaves its leftovers to be picked up by the next fetch.

## Considered Options

- **Draft directly from `new`** (Keep optional): fewer clicks, but blurs "shortlist" vs "commit to drafting" and makes the dashboard's default un-triaged view double as a drafting surface.
- **Fully reversible states** (un-dismiss, re-draft): more flexible, but every transition needs a UI affordance and an answer for "what happens to the already-written draft file on re-draft." Not worth it for a single-user tool.
- **Score only this fetch's freshly-inserted rows**: would orphan `score IS NULL` leftovers from a crashed run, since `ON CONFLICT DO NOTHING` means a later fetch never re-inserts them to retrigger scoring.

## Consequences

- The dashboard's default view is `status = new`; drafting happens from the `kept` filter, not the main feed.
- `score IS NULL` does double duty: "not yet scored" and "resume me." Because Items are immutable snapshots (`ON CONFLICT DO NOTHING`), a non-null score is never reset, so this marker stays unambiguous.
- Reaching `drafted` is the guard against accidental re-drafting (a drafted Item leaves the `kept` view); there is no separate lock.
