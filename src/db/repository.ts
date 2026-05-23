import type { Pool, PoolClient } from "pg";
import type { ScorableItem, ScoreResult } from "#/scoring/types";
import type { NormalizedItem } from "#/sources/types";
import { getPool } from "./client";

/** Anything that can run a parameterized query (a Pool or a checked-out client). */
type Queryable = Pick<Pool | PoolClient, "query">;

/**
 * A full `items` row as `pg` returns it: `timestamptz` columns come back as
 * `Date`, `integer` as `number`, the rest as `string | null`. (The browser sees
 * a different, all-string shape over the Electric collection.)
 */
export interface ItemRow {
	id: string;
	source: string;
	external_id: string;
	url: string;
	title: string;
	author: string | null;
	published_at: Date;
	raw_text: string | null;
	status: string;
	score: number | null;
	score_reason: string | null;
	draft_path: string | null;
	created_at: Date;
}

/**
 * The triage state machine (ADR-0001), as a map from each target status to the
 * statuses an Item may legally move there *from*. `new` is the start state (no
 * transitions into it); `dismissed` and `drafted` are terminal (absent as
 * `from` values). The single source of truth {@link setStatus} enforces.
 */
export const TRIAGE_TRANSITIONS: Record<string, readonly string[]> = {
	kept: ["new"],
	dismissed: ["new", "kept"],
	drafted: ["kept"],
};

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

/**
 * Move an Item through the triage state machine, enforcing {@link
 * TRIAGE_TRANSITIONS}: the `status = any(...)` guard only matches when the
 * Item's current status is a legal `from` for the target, so an illegal jump, a
 * terminal Item, or a missing id all yield zero updated rows and throw. Runs in
 * one transaction and returns its Postgres `txid` so the Electric collection can
 * drop the optimistic write once the change syncs back.
 */
export async function setStatus(
	id: string,
	status: string,
	pool: Pool = getPool(),
): Promise<number> {
	const allowedFrom = TRIAGE_TRANSITIONS[status];
	if (!allowedFrom) {
		throw new Error(`Unknown triage status: ${status}`);
	}

	const client = await pool.connect();
	try {
		await client.query("begin");
		const result = await client.query(
			`update items
			 set status = $2
			 where id = $1 and status = any($3::text[])`,
			[id, status, allowedFrom],
		);
		if (result.rowCount === 0) {
			throw new Error(
				`Illegal triage transition to '${status}' for Item ${id} (must be one of: ${allowedFrom.join(", ")})`,
			);
		}
		const { rows } = await client.query<{ txid: string }>(
			"select pg_current_xact_id()::xid::text as txid",
		);
		await client.query("commit");
		return Number(rows[0].txid);
	} catch (error) {
		await client.query("rollback");
		throw error;
	} finally {
		client.release();
	}
}

/**
 * Every Item in a given triage status, ordered like the feed (highest Score
 * first, unscored last, newest-first within a tie). Backs the status-scoped
 * dashboard views; the live feed itself filters the Electric collection
 * client-side, but this is the server-side query the triage tests assert on.
 */
export async function itemsByStatus(
	status: string,
	db: Queryable = getPool(),
): Promise<ItemRow[]> {
	const { rows } = await db.query<ItemRow>(
		`select *
		 from items
		 where status = $1
		 order by score desc nulls last, published_at desc`,
		[status],
	);
	return rows;
}
