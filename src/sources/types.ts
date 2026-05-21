/**
 * The common shape every Source normalizes its Items into before they are
 * inserted. Mirrors the not-yet-triaged columns of the `items` table; status,
 * score, and draft fields are assigned later in the pipeline.
 */
export interface NormalizedItem {
	/** Stable lowercase Source slug, e.g. "hackernews". */
	source: string;
	/** The Source's own id for this Item; unique per source. */
	externalId: string;
	url: string;
	title: string;
	author: string | null;
	publishedAt: Date;
	/** Best body available at fetch time; null when the Source has none. */
	rawText: string | null;
}

/**
 * Per-Source outcome of a "Fetch now" run. One failing Source carries its error
 * here instead of aborting the whole run.
 */
export interface PerSourceSummary {
	source: string;
	fetched: number;
	inserted: number;
	error?: string;
}
