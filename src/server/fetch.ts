import { createServerFn } from "@tanstack/react-start";
import type { PerSourceSummary } from "#/sources/types";
import { realDeps, runFetch } from "./run-fetch";

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
 * "Fetch now" as a server function: drives {@link runFetch} with the real deps
 * and pipes its events into a {@link ReadableStream} for the route to read. The
 * actual Scores still reach the feed via Electric as each batch is persisted;
 * this stream drives the ephemeral progress bar and per-run cost summary.
 *
 * The orchestration core and its server-only deps live in `./run-fetch`,
 * imported only here inside the handler, so the DB layer (and `pg`) never reach
 * the client bundle.
 */
export const fetchNow = createServerFn({ method: "POST" }).handler(
	async (): Promise<ReadableStream<FetchProgress>> => {
		return new ReadableStream<FetchProgress>({
			async start(controller) {
				for await (const event of runFetch(realDeps)) {
					controller.enqueue(event);
				}
				controller.close();
			},
		});
	},
);
