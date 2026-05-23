import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { NormalizedItem } from "#/sources/types";
import { insertNew, itemsByStatus, setStatus } from "./repository";

// Runs against the dedicated content_manager_test database (migrated by dbmate
// in globalSetup). Skipped when TEST_DATABASE_URL is unset so the suite stays
// green without a local Postgres.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

const item: NormalizedItem = {
	source: "hackernews",
	externalId: "42",
	url: "https://example.com/a",
	title: "An Item",
	author: "alice",
	publishedAt: new Date("2026-05-21T00:00:00Z"),
	rawText: null,
};

describe.skipIf(!testDatabaseUrl)("insertNew", () => {
	const pool = new Pool({ connectionString: testDatabaseUrl });

	afterAll(async () => {
		await pool.end();
	});

	beforeEach(async () => {
		await pool.query("truncate items");
	});

	it("inserts a new Item and reports the count", async () => {
		const inserted = await insertNew([item], pool);
		expect(inserted).toBe(1);
	});

	it("dedups on (source, external_id) — a re-fetch inserts no duplicate", async () => {
		await insertNew([item], pool);
		const inserted = await insertNew([item], pool);
		expect(inserted).toBe(0);

		const { rows } = await pool.query<{ count: number }>(
			"select count(*)::int as count from items",
		);
		expect(rows[0].count).toBe(1);
	});
});

describe.skipIf(!testDatabaseUrl)("setStatus", () => {
	const pool = new Pool({ connectionString: testDatabaseUrl });

	afterAll(async () => {
		await pool.end();
	});

	beforeEach(async () => {
		await pool.query("truncate items");
		await insertNew([item], pool);
	});

	async function itemId(): Promise<string> {
		const { rows } = await pool.query<{ id: string }>("select id from items");
		return rows[0].id;
	}

	async function statusOf(id: string): Promise<string> {
		const { rows } = await pool.query<{ status: string }>(
			"select status from items where id = $1",
			[id],
		);
		return rows[0].status;
	}

	it("keeps a new Item (new → kept)", async () => {
		const id = await itemId();
		await setStatus(id, "kept", pool);
		expect(await statusOf(id)).toBe("kept");
	});

	it("dismisses a new Item (new → dismissed)", async () => {
		const id = await itemId();
		await setStatus(id, "dismissed", pool);
		expect(await statusOf(id)).toBe("dismissed");
	});

	it("dismisses a kept Item — the escape hatch (kept → dismissed)", async () => {
		const id = await itemId();
		await setStatus(id, "kept", pool);
		await setStatus(id, "dismissed", pool);
		expect(await statusOf(id)).toBe("dismissed");
	});

	it("rejects an illegal jump (new → drafted) and leaves the Item untouched", async () => {
		const id = await itemId();
		await expect(setStatus(id, "drafted", pool)).rejects.toThrow();
		expect(await statusOf(id)).toBe("new");
	});

	it("treats dismissed as terminal — no transition out", async () => {
		const id = await itemId();
		await setStatus(id, "dismissed", pool);
		await expect(setStatus(id, "kept", pool)).rejects.toThrow();
		expect(await statusOf(id)).toBe("dismissed");
	});

	it("rejects an unknown target status", async () => {
		const id = await itemId();
		await expect(setStatus(id, "archived", pool)).rejects.toThrow(
			/unknown triage status/i,
		);
	});
});

describe.skipIf(!testDatabaseUrl)("itemsByStatus", () => {
	const pool = new Pool({ connectionString: testDatabaseUrl });

	afterAll(async () => {
		await pool.end();
	});

	beforeEach(async () => {
		await pool.query("truncate items");
	});

	function at(externalId: string): NormalizedItem {
		return { ...item, externalId, url: `https://example.com/${externalId}` };
	}

	it("returns only the Items in the requested status", async () => {
		await insertNew([at("1"), at("2"), at("3")], pool);
		const { rows } = await pool.query<{ id: string; external_id: string }>(
			"select id, external_id from items order by external_id",
		);
		await setStatus(rows[0].id, "kept", pool);
		await setStatus(rows[1].id, "dismissed", pool);

		const newOnes = await itemsByStatus("new", pool);
		expect(newOnes.map((r) => r.external_id)).toEqual(["3"]);

		const kept = await itemsByStatus("kept", pool);
		expect(kept.map((r) => r.external_id)).toEqual(["1"]);

		const dismissed = await itemsByStatus("dismissed", pool);
		expect(dismissed.map((r) => r.external_id)).toEqual(["2"]);
	});
});
