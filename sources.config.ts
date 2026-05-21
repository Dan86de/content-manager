/**
 * Curated Source configuration. Edit this to change what gets fetched.
 *
 * Each Source has a stable lowercase slug (the convention for all future sources:
 * `reddit`, `youtube`, `rss`). HackerNews is the only Source in the walking
 * skeleton; the score sweep and additional Sources slot in later without
 * reshaping this list.
 */

/** Stable lowercase slug stored in `items.source`. */
export const HACKERNEWS = "hackernews";

/**
 * HackerNews search keywords. One Algolia `/search_by_date` request runs per
 * keyword over the last 24h. Seeded from niche.md — tune freely.
 */
export const HN_KEYWORDS = [
	"claude code",
	"ai agents",
	"mcp",
	"cursor",
	"anthropic",
	"claude",
	"agent sdk",
	"codex",
] as const;

/** How far back each fetch looks, in hours. */
export const LOOKBACK_HOURS = 24;
