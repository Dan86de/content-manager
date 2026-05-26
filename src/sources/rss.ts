import Parser from "rss-parser";
import { RSS } from "../../sources.config";
import { withinLookback } from "./lookback";
import type { NormalizedItem } from "./types";

/**
 * Feed fields `rss-parser` doesn't surface by default. `content:encoded` is the
 * full HTML body (preferred over the truncated `contentSnippet`); `author` is
 * the RSS-2.0 fallback when there's no `dc:creator`.
 */
interface RssExtraFields {
	author?: string;
	"content:encoded"?: string;
}

/** A parsed feed entry, after rss-parser absorbs RSS-2.0-vs-Atom variance. */
export type RssEntry = Parser.Item & RssExtraFields;

/**
 * Shared, network-free parser. Exported so tests can `parseString` an XML
 * fixture with the same `content:encoded` mapping the fetcher uses.
 */
export const rssParser = new Parser<Record<string, unknown>, RssExtraFields>({
	customFields: { item: ["author", "content:encoded"] },
});

/**
 * Map parsed feed entries into the common shape. Entries with no stable id
 * (`guid ?? link`) are dropped — unusable for dedup; undated entries are
 * dropped too, since they can't honor the lookback contract and an Invalid Date
 * would corrupt the feed's `published_at desc` sort.
 */
export function normalizeRssItems(entries: RssEntry[]): NormalizedItem[] {
	const items: NormalizedItem[] = [];
	for (const entry of entries) {
		const externalId = entry.guid ?? entry.link;
		if (!externalId) {
			continue;
		}
		const dateStr = entry.isoDate ?? entry.pubDate;
		if (!dateStr) {
			continue;
		}
		const publishedAt = new Date(dateStr);
		if (Number.isNaN(publishedAt.getTime())) {
			continue;
		}
		items.push({
			source: RSS,
			externalId,
			url: entry.link ?? "",
			title: entry.title ?? "",
			author: entry.creator ?? entry.author ?? null,
			publishedAt,
			rawText:
				entry["content:encoded"] ??
				entry.content ??
				entry.contentSnippet ??
				null,
		});
	}
	return items;
}

/**
 * Fetch each configured feed over the last
 * {@link import("../../sources.config").LOOKBACK_HOURS}. Empty `feedUrls`
 * returns `[]`. Each feed is an independent failure domain: one unreachable URL
 * is skipped and logged, but if *every* feed fails the aggregated error is
 * rethrown so a dead run never reads as "nothing new in 24h". Within-source
 * dedup is by `externalId`; the same article syndicated across two feeds with
 * different guids won't dedup (acceptable for v1).
 */
export async function fetchRss(
	feedUrls: readonly string[],
	now: Date = new Date(),
): Promise<NormalizedItem[]> {
	if (feedUrls.length === 0) {
		return [];
	}

	const byId = new Map<string, NormalizedItem>();
	let failed = 0;

	for (const feedUrl of feedUrls) {
		try {
			const feed = await rssParser.parseURL(feedUrl);
			for (const item of withinLookback(normalizeRssItems(feed.items), now)) {
				byId.set(item.externalId, item);
			}
		} catch (error) {
			failed += 1;
			console.error(`RSS feed ${feedUrl} skipped`, error);
		}
	}

	if (failed === feedUrls.length) {
		throw new Error(`All ${feedUrls.length} RSS feeds failed`);
	}

	return [...byId.values()];
}
