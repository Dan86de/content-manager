/**
 * The Scorer's data shapes. An Item flows in as a `ScorableItem` (the columns
 * Haiku needs to judge relevance) and a Score comes back as a `ScoreResult`
 * (what the repository writes onto the row).
 */

/**
 * An Item awaiting a Score — the `score IS NULL` rows the sweep picks up. `id`
 * is a string because pg returns `int8` as a string; it is the stable handle
 * Haiku must echo so results map back by id, never by array position.
 */
export interface ScorableItem {
	id: string;
	title: string;
	url: string;
	/** Best body available at fetch time; null when the Source had none. */
	rawText: string | null;
}

/** One scored Item: an integer Score 0–10 and the one-line reason behind it. */
export interface ScoreResult {
	id: string;
	score: number;
	reason: string;
}

/** Token usage TanStack AI reports for a single scoring call. */
export interface BatchUsage {
	inputTokens: number;
	outputTokens: number;
}

/**
 * Why each Item in a batch did or didn't get a Score — a per-run diagnostic
 * that lets the summary show the gap between Items sent and Items scored.
 * Mutually exclusive per Item: when the response parses, each sent Item is
 * `scored`, `omitted` (the model returned no entry for it), or
 * `validationDropped` (an entry came back but failed the schema). When the
 * whole response is unparseable the batch counts as `parseFailed`, and when the
 * call throws it counts as `batchErrored`. The five always sum to `sent`.
 */
export interface BatchOutcome {
	scored: number;
	omitted: number;
	validationDropped: number;
	parseFailed: number;
	batchErrored: number;
}

/**
 * The Scorer's output for one batch: the Scores it could extract, the token
 * usage of the call (null when the call failed or reported none), `sent` — how
 * many Items rode in the batch, so the orchestrator can advance a precise
 * progress bar even when some entries came back malformed — and the per-Item
 * {@link BatchOutcome} breakdown behind that count.
 */
export interface ScoredBatch {
	scores: ScoreResult[];
	usage: BatchUsage | null;
	sent: number;
	outcome: BatchOutcome;
}
