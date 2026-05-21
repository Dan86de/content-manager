import { HACKERNEWS, LOOKBACK_HOURS } from "../../sources.config";
import type { NormalizedItem } from "./types";

const SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date";
const HN_ITEM_URL = "https://news.ycombinator.com/item?id=";

/** One hit from the Algolia HN search API (only the fields we use). */
export interface AlgoliaHit {
	objectID: string;
	title: string | null;
	url: string | null;
	author: string | null;
	/** Self-post body (Ask/Show HN); null for link posts. */
	story_text: string | null;
	/** Creation time in epoch seconds. */
	created_at_i: number;
}

interface AlgoliaResponse {
	hits: AlgoliaHit[];
}

/**
 * Map a single Algolia hit into the common shape. When `url` is null
 * (Ask/Show HN), fall back to the HN permalink; `story_text` becomes the
 * (nullable) raw body.
 */
export function normalizeHit(hit: AlgoliaHit): NormalizedItem {
	return {
		source: HACKERNEWS,
		externalId: hit.objectID,
		url: hit.url ?? `${HN_ITEM_URL}${hit.objectID}`,
		title: hit.title ?? "",
		author: hit.author ?? null,
		publishedAt: new Date(hit.created_at_i * 1000),
		rawText: hit.story_text ?? null,
	};
}

export function normalizeHits(hits: AlgoliaHit[]): NormalizedItem[] {
	return hits.map(normalizeHit);
}

/**
 * Fetch HackerNews stories matching `keywords` over the last {@link LOOKBACK_HOURS}.
 * One strictly-chronological `/search_by_date` request runs per keyword (so the
 * window is complete), with `tags=story` to exclude comments/jobs/polls. Hits are
 * deduped by `objectID` across keywords; `ON CONFLICT` dedups against stored Items.
 */
export async function fetchHackerNews(
	keywords: readonly string[],
	now: Date = new Date(),
): Promise<NormalizedItem[]> {
	const cutoff = Math.floor(now.getTime() / 1000) - LOOKBACK_HOURS * 3600;
	const byId = new Map<string, NormalizedItem>();

	for (const keyword of keywords) {
		const url = new URL(SEARCH_URL);
		url.searchParams.set("query", keyword);
		url.searchParams.set("tags", "story");
		url.searchParams.set("numericFilters", `created_at_i>${cutoff}`);
		url.searchParams.set("hitsPerPage", "100");

		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(
				`HackerNews search failed for "${keyword}": ${response.status} ${response.statusText}`,
			);
		}
		const body = (await response.json()) as AlgoliaResponse;
		for (const item of normalizeHits(body.hits)) {
			byId.set(item.externalId, item);
		}
	}

	return [...byId.values()];
}
