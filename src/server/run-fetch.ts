import { insertNew, setScores, unscoredItems } from "#/db/repository";
import { estimateUsd } from "#/scoring/cost";
import { loadNiche } from "#/scoring/niche";
import { scoreItems } from "#/scoring/scorer";
import { fetchHackerNews } from "#/sources/hackernews";
import { fetchRss } from "#/sources/rss";
import type { NormalizedItem, PerSourceSummary } from "#/sources/types";
import { fetchYouTube } from "#/sources/youtube";
import {
	HACKERNEWS,
	HN_KEYWORDS,
	RSS,
	RSS_FEEDS,
	YOUTUBE,
	YOUTUBE_CHANNELS,
} from "../../sources.config";
import type { FetchProgress, OutcomeSummary } from "./fetch";

/**
 * This module owns the orchestration core and every server-only dependency it
 * pulls in (the DB layer, the Scorer, the Source fetchers). It is imported only
 * from {@link import("./fetch").fetchNow}'s handler, never from the client, so
 * `pg` and the rest stay out of the browser bundle.
 */

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
	{ source: YOUTUBE, fetch: () => fetchYouTube(YOUTUBE_CHANNELS) },
	{ source: RSS, fetch: () => fetchRss(RSS_FEEDS) },
];

/**
 * Everything {@link runFetch} touches the outside world through, injected so
 * the orchestration can be tested with fakes (a throwing Source, a throwing
 * scoring sweep) instead of a live DB and the Claude API. {@link realDeps}
 * wires the real implementations.
 */
export interface RunFetchDeps {
	sources: SourceFetcher[];
	insertNew: typeof insertNew;
	scoreItems: typeof scoreItems;
	loadNiche: typeof loadNiche;
	unscoredItems: typeof unscoredItems;
	setScores: typeof setScores;
}

/** The real DB + scoring + Source wiring {@link runFetch} runs against in production. */
export const realDeps: RunFetchDeps = {
	sources: SOURCES,
	insertNew,
	scoreItems,
	loadNiche,
	unscoredItems,
	setScores,
};

/**
 * The orchestration core behind "Fetch now", as an async generator of
 * {@link FetchProgress} events: pull Items from every Source, insert the new
 * ones, then score the whole `score IS NULL` sweep against the Niche. Each
 * Source is fault-isolated (one failing fetch records its error and the run
 * continues), and the scoring sweep is wrapped so a scoring failure never fails
 * the run; the terminal `done` event always lands with whatever was fetched and
 * scored.
 *
 * All side effects come through the injected {@link RunFetchDeps}, so the
 * fault-isolation paths can be exercised with fakes. {@link import("./fetch").fetchNow}
 * drives it with {@link realDeps} and pipes this into a `ReadableStream`.
 */
export async function* runFetch(
	deps: RunFetchDeps,
): AsyncGenerator<FetchProgress> {
	const summaries: PerSourceSummary[] = [];
	let inputTokens = 0;
	let outputTokens = 0;
	let batches = 0;
	const outcome: OutcomeSummary = {
		total: 0,
		scored: 0,
		omitted: 0,
		validationDropped: 0,
		parseFailed: 0,
		batchErrored: 0,
	};

	try {
		for (const { source, fetch } of deps.sources) {
			let summary: PerSourceSummary;
			try {
				const items = await fetch();
				const inserted = await deps.insertNew(items);
				summary = { source, fetched: items.length, inserted, failed: false };
			} catch (error) {
				summary = {
					source,
					fetched: 0,
					inserted: 0,
					failed: true,
					error: error instanceof Error ? error.message : String(error),
				};
			}
			summaries.push(summary);
			yield { phase: "fetch", summary };
		}

		// One global scoring sweep over every `score IS NULL` Item. Each batch is
		// persisted immediately (Electric streams it into the feed) and reported
		// here so the bar advances by Items actually attempted.
		try {
			const niche = await deps.loadNiche();
			const items = await deps.unscoredItems();
			const total = items.length;
			let processed = 0;
			yield { phase: "score", processed, total };
			for await (const batch of deps.scoreItems(items, niche)) {
				await deps.setScores(batch.scores);
				processed += batch.sent;
				batches += 1;
				if (batch.usage) {
					inputTokens += batch.usage.inputTokens;
					outputTokens += batch.usage.outputTokens;
				}
				outcome.total += batch.sent;
				outcome.scored += batch.outcome.scored;
				outcome.omitted += batch.outcome.omitted;
				outcome.validationDropped += batch.outcome.validationDropped;
				outcome.parseFailed += batch.outcome.parseFailed;
				outcome.batchErrored += batch.outcome.batchErrored;
				yield { phase: "score", processed, total };
			}
		} catch (error) {
			console.error("scoring sweep failed", error);
		}
	} finally {
		yield {
			phase: "done",
			summaries,
			cost: {
				inputTokens,
				outputTokens,
				batches,
				usd: estimateUsd(inputTokens, outputTokens),
			},
			outcome,
		};
	}
}
