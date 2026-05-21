import type { Pool, PoolClient } from "pg";
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
