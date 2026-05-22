import type { Pool, PoolClient } from "pg";
import type { ScorableItem, ScoreResult } from "#/scoring/types";
import type { NormalizedItem } from "#/sources/types";
import { getPool } from "./client";

/** Anything that can run a parameterized query (a Pool or a checked-out client). */
type Queryable = Pick<Pool | PoolClient, "query">;

/**
 * Insert freshly-fetched Items, skipping any whose `(source, external_id)` is
 * already stored. Items are immutable snapshots, so `ON CONFLICT DO NOTHING`
 * makes a re-fetch a no-op rather than overwriting (and never resets a Score).
 *
 * Returns the number of rows actually inserted.
 */
export async function insertNew(
	items: NormalizedItem[],
	db: Queryable = getPool(),
): Promise<number> {
	let inserted = 0;
	for (const item of items) {
		const result = await db.query(
			`insert into items (source, external_id, url, title, author, published_at, raw_text)
			 values ($1, $2, $3, $4, $5, $6, $7)
			 on conflict (source, external_id) do nothing`,
			[
				item.source,
				item.externalId,
				item.url,
				item.title,
				item.author,
				item.publishedAt,
				item.rawText,
			],
		);
		inserted += result.rowCount ?? 0;
	}
	return inserted;
}

/**
 * The `score IS NULL` sweep: every unscored Item, regardless of which fetch
 * inserted it, so leftovers from an interrupted scoring run get picked up next
 * time (see ADR-0001). Returns only the columns the Scorer judges relevance on.
 */
export async function unscoredItems(
	db: Queryable = getPool(),
): Promise<ScorableItem[]> {
	const { rows } = await db.query<ScorableItem>(
		`select id, title, url, raw_text as "rawText"
		 from items
		 where score is null`,
	);
	return rows;
}

/**
 * Write each computed Score onto its Item. The `and score is null` guard keeps
 * re-runs idempotent: an Item scored by an earlier batch is never overwritten,
 * which is also why a double sweep can't reset a Score.
 */
export async function setScores(
	results: ScoreResult[],
	db: Queryable = getPool(),
): Promise<void> {
	for (const { id, score, reason } of results) {
		await db.query(
			`update items
			 set score = $2, score_reason = $3
			 where id = $1 and score is null`,
			[id, score, reason],
		);
	}
}
