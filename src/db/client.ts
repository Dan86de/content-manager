import { Pool } from "pg";

/**
 * Server-only Postgres connection pool. All DB writes go through server
 * functions; no `pg` client (and no `DATABASE_URL`) ever reaches the browser.
 */
let pool: Pool | undefined;

export function getPool(): Pool {
	if (!pool) {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) {
			throw new Error("DATABASE_URL is not set");
		}
		pool = new Pool({ connectionString });
	}
	return pool;
}
