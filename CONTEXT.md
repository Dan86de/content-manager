# Content Manager

A single-user, local-only tool that fetches items from curated sources, scores them against a personal niche, and turns chosen items into voice-matched content drafts in an Obsidian vault.

## Language

**Item**:
A single piece of content pulled from a source, normalized into a common shape (source, external id, url, title, author, published date, raw text).
_Avoid_: post, entry, row, result

**Source**:
An external feed an Item comes from — HackerNews, a subreddit, a YouTube channel, or an RSS/newsletter feed.
_Avoid_: platform, channel (channel means a YouTube channel specifically), feed (feed = the dashboard list of Items)

**Niche**:
The personal relevance spec (in `niche.md`) the Scorer rates each Item against. The single lever controlling what counts as relevant.

**Score**:
An integer 0–10 assigned to an Item measuring fit against the Niche, with a one-line reason.

**Triage status**:
An Item's position in the triage workflow. One of:
- **new** — fetched and scored, not yet triaged (the default dashboard view)
- **kept** — shortlisted; the only state from which an Item can be Drafted
- **dismissed** — removed from view; terminal
- **drafted** — turned into a Draft; terminal

**Keep / Dismiss / Draft**:
The three triage actions. Keep shortlists a `new` Item; Dismiss removes it; Draft (only on a `kept` Item) generates content.

**Draft**:
The generated output for one Item — a single markdown file containing three voice-matched format sections (YouTube hook, LinkedIn post, X thread) plus traceability frontmatter, written into the vault's "Content Drafts" folder.

**Voice**:
The writing-style spec the Draft Generator matches, formed by concatenating every `.md` file in the vault's "02 Writing Guidelines/" folder.

**Enrichment**:
Obtaining the best available content body for an Item at Draft time — the linked article's main text, a YouTube transcript, or an already-full self-post body. A Draft is flagged **enriched** when that body is substantive (vs thin, e.g. just a headline + blurb); the flag is purely about input quality, not which path produced it.

## Relationships

- A **Source** yields many **Items**
- Each **Item** has at most one **Score** and exactly one **Triage status**
- Triage transitions: `new -> kept`, `new -> dismissed`, `kept -> drafted`, `kept -> dismissed`. `dismissed` and `drafted` are terminal.
- A **Draft** is produced from exactly one **kept Item** and matches the **Voice**

## Flagged ambiguities

- "Draft" is both a noun (the generated file) and the verb action (`kept -> drafted`). Kept distinct by context.
- Keep is a **mandatory** step before Draft — you cannot Draft a `new` Item directly.
