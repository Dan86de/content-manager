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
