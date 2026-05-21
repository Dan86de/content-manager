import { createServerFn } from "@tanstack/react-start";
import { insertNew } from "#/db/repository";
import { fetchHackerNews } from "#/sources/hackernews";
import type { NormalizedItem, PerSourceSummary } from "#/sources/types";
import { HACKERNEWS, HN_KEYWORDS } from "../../sources.config";

/**
 * A Source the run pulls from. The list is the only thing that grows as Sources
 * are added (reddit, youtube, rss); the orchestration around it stays the same.
 */
interface SourceFetcher {
	source: string;
	fetch: () => Promise<NormalizedItem[]>;
}

const SOURCES: SourceFetcher[] = [
	{ source: HACKERNEWS, fetch: () => fetchHackerNews(HN_KEYWORDS) },
];

/**
 * "Fetch now": pull Items from every Source, insert the new ones, and report a
 * per-Source summary. Each Source is fault-isolated — one failing fetch records
 * its error and the run continues. (Scoring the `score IS NULL` sweep slots in
 * here later.)
 */
export const fetchNow = createServerFn({ method: "POST" }).handler(
	async (): Promise<PerSourceSummary[]> => {
		const summaries: PerSourceSummary[] = [];
		for (const { source, fetch } of SOURCES) {
			try {
				const items = await fetch();
				const inserted = await insertNew(items);
				summaries.push({ source, fetched: items.length, inserted });
			} catch (error) {
				summaries.push({
					source,
					fetched: 0,
					inserted: 0,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return summaries;
	},
);
