import { createServerFn } from "@tanstack/react-start";
import { insertNew, setScores, unscoredItems } from "#/db/repository";
import { loadNiche } from "#/scoring/niche";
import { scoreItems } from "#/scoring/scorer";
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
 * "Fetch now": pull Items from every Source, insert the new ones, then score
 * the whole `score IS NULL` sweep against the Niche, and report a per-Source
 * summary. Each Source is fault-isolated — one failing fetch records its error
 * and the run continues. The summary carries no Score count; the live feed,
 * which Electric streams each persisted batch into, is the only evidence of
 * scoring.
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

		// One global scoring sweep after every Source has been inserted. Each
		// yielded batch is persisted immediately so Electric streams it into the
		// feed. Per-batch faults are contained inside scoreItems; this outer guard
		// is the last resort so a scoring failure never fails the fetch itself.
		try {
			const niche = await loadNiche();
			for await (const batch of scoreItems(await unscoredItems(), niche)) {
				await setScores(batch);
			}
		} catch (error) {
			console.error("scoring sweep failed", error);
		}

		return summaries;
	},
);
