import { execSync } from "node:child_process";

/**
 * Vitest global setup. When TEST_DATABASE_URL is set, dbmate creates the test
 * database (if needed) and applies the migrations in db/migrations against it,
 * giving the repository tests real `ON CONFLICT` semantics. No-op otherwise, so
 * the suite runs without a local Postgres.
 *
 * Requires the dbmate binary on PATH (`brew install dbmate`).
 */
export default function setup() {
	const databaseUrl = process.env.TEST_DATABASE_URL;
	if (!databaseUrl) {
		console.warn("TEST_DATABASE_URL not set — skipping Postgres-backed tests.");
		return;
	}

	execSync("dbmate --no-dump-schema up", {
		stdio: "inherit",
		env: { ...process.env, DATABASE_URL: databaseUrl },
	});
}
