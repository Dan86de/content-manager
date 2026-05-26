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
/** Stable lowercase slug stored in `items.source`. */
export const YOUTUBE = "youtube";
/** Stable lowercase slug stored in `items.source`. */
export const RSS = "rss";

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

/**
 * YouTube channel IDs (`UC…`) whose uploads are fetched. Each channel costs one
 * `playlistItems.list` quota unit/fetch. Find a channel's ID on its page via
 * About → Share channel → Copy channel ID.
 */
export const YOUTUBE_CHANNELS: readonly string[] = [
	"UCUyeluBRhGPCW4rPe_UvBZQ",
	"UCbRP3c757lWg9M-U7TyEkXA",
	"UCLKPca3kwwd-B59HNr-_lvA",
	"UCsrVDPJBYeXItETFHG0qzyw",
];

/**
 * RSS / newsletter feed URLs, fetched keyless.
 */
export const RSS_FEEDS: readonly string[] = [
	"https://simonwillison.net/atom/everything/",
	"https://news.smol.ai/rss.xml",
];

/** How far back each fetch looks, in hours. */
export const LOOKBACK_HOURS = 24;
