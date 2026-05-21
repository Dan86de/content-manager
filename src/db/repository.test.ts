import { Pool } from "pg";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { NormalizedItem } from "#/sources/types";
import { insertNew } from "./repository";

// Runs against the dedicated content_manager_test database (migrated by dbmate
// in globalSetup). Skipped when TEST_DATABASE_URL is unset so the suite stays
// green without a local Postgres.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("insertNew", () => {
	const pool = new Pool({ connectionString: testDatabaseUrl });

	afterAll(async () => {
		await pool.end();
	});

	beforeEach(async () => {
		await pool.query("truncate items");
	});

	const item: NormalizedItem = {
		source: "hackernews",
		externalId: "42",
		url: "https://example.com/a",
		title: "An Item",
		author: "alice",
		publishedAt: new Date("2026-05-21T00:00:00Z"),
		rawText: null,
	};

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
