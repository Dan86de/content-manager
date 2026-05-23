import { createServerFn } from "@tanstack/react-start";
import { insertNew, setScores, unscoredItems } from "#/db/repository";
import { estimateUsd } from "#/scoring/cost";
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

/** Token totals and estimated USD for one run's scoring calls. */
export interface CostSummary {
	inputTokens: number;
	outputTokens: number;
	/** Number of Haiku calls (batches) made. */
	batches: number;
	usd: number;
}

/**
 * Per-run tally of why Items did or didn't get a Score (the sum of every
 * batch's {@link import("#/scoring/types").BatchOutcome}). `total` is the
 * Items the sweep attempted, equal to `scored + omitted + validationDropped +
 * parseFailed + batchErrored`. A confirmation aid: it surfaces the gap between
 * Items sent and Items scored so we can see which bucket dominates.
 */
export interface OutcomeSummary {
	total: number;
	scored: number;
	omitted: number;
	validationDropped: number;
	parseFailed: number;
	batchErrored: number;
}

/**
 * A progress event streamed from {@link fetchNow} as a run unfolds: a Source
 * just finished fetching, the scoring sweep advanced, or the run is done (the
 * terminal event, carrying the full summary, cost, and scoring outcome).
 */
export type FetchProgress =
	| { phase: "fetch"; summary: PerSourceSummary }
	| { phase: "score"; processed: number; total: number }
	| {
			phase: "done";
			summaries: PerSourceSummary[];
			cost: CostSummary;
			outcome: OutcomeSummary;
	  };

/**
 * "Fetch now": pull Items from every Source, insert the new ones, then score
 * the whole `score IS NULL` sweep against the Niche — streaming progress as it
 * goes. Each Source is fault-isolated (one failing fetch records its error and
 * the run continues), and the scoring sweep is wrapped so a scoring failure
 * never fails the run; the terminal `done` event always lands with whatever was
 * fetched and scored.
 *
 * Returns a {@link ReadableStream} of {@link FetchProgress} events. The actual
 * Scores still reach the feed via Electric as each batch is persisted; this
 * stream drives the ephemeral progress bar and per-run cost summary.
 */
export const fetchNow = createServerFn({ method: "POST" }).handler(
	async (): Promise<ReadableStream<FetchProgress>> => {
		return new ReadableStream<FetchProgress>({
			async start(controller) {
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
					for (const { source, fetch } of SOURCES) {
						let summary: PerSourceSummary;
						try {
							const items = await fetch();
							const inserted = await insertNew(items);
							summary = { source, fetched: items.length, inserted };
						} catch (error) {
							summary = {
								source,
								fetched: 0,
								inserted: 0,
								error: error instanceof Error ? error.message : String(error),
							};
						}
						summaries.push(summary);
						controller.enqueue({ phase: "fetch", summary });
					}

					// One global scoring sweep over every `score IS NULL` Item. Each
					// batch is persisted immediately (Electric streams it into the feed)
					// and reported here so the bar advances by Items actually attempted.
					try {
						const niche = await loadNiche();
						const items = await unscoredItems();
						const total = items.length;
						let processed = 0;
						controller.enqueue({ phase: "score", processed, total });
						for await (const batch of scoreItems(items, niche)) {
							await setScores(batch.scores);
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
							controller.enqueue({ phase: "score", processed, total });
						}
					} catch (error) {
						console.error("scoring sweep failed", error);
					}
				} finally {
					controller.enqueue({
						phase: "done",
						summaries,
						cost: {
							inputTokens,
							outputTokens,
							batches,
							usd: estimateUsd(inputTokens, outputTokens),
						},
						outcome,
					});
					controller.close();
				}
			},
		});
	},
);
