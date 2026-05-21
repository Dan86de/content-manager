-- migrate:up
create table items (
    id uuid primary key default gen_random_uuid(),
    -- Stable lowercase source slug ("hackernews"); display name is UI-only.
    source text not null,
    -- The source's own id for this Item (HN objectID); unique per source.
    external_id text not null,
    url text not null,
    title text not null,
    author text,
    published_at timestamptz not null,
    -- Best body available at fetch time; null for link posts (no enrichment yet).
    raw_text text,
    -- Triage status (ADR-0001). score IS NULL is the "needs scoring" marker.
    status text not null default 'new'
        check (status in ('new', 'kept', 'dismissed', 'drafted')),
    score integer check (score between 0 and 10),
    score_reason text,
    draft_path text,
    created_at timestamptz not null default now(),
    -- Items are immutable snapshots; re-fetch dedups on this (INSERT ... ON CONFLICT).
    unique (source, external_id)
);

-- migrate:down
drop table items;
