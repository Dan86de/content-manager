/**
 * Retry-with-backoff for the Scorer's (and later the Drafter's) Claude calls.
 *
 * Claude returns HTTP 429 (rate limited) or 529 (overloaded) under load, and a
 * fetch run fires many scoring calls back to back. The high-level `chat()`
 * helper throws those as a plain `Error` with no status attached, so we can't
 * cheaply tell a 429 from any other transport failure — and we don't need to.
 * The default policy retries *any* throw: a transient 429/529 clears on a later
 * attempt, while a genuinely broken call simply exhausts its retries and
 * propagates, landing in the caller's existing fault-isolation backstop (a
 * scoring batch left `score IS NULL` to retry next sweep).
 */

/** Knobs for {@link withRetry}; every field has a sensible default. */
export interface RetryOptions {
	/** Total attempts including the first try. */
	attempts?: number;
	/** Base delay the exponential backoff doubles from. */
	baseMs?: number;
	/** Ceiling on a single backoff sleep. */
	capMs?: number;
	/** Whether a given error is worth retrying. Defaults to "always". */
	isRetryable?: (error: unknown) => boolean;
	/** Sleep for `ms`. Injectable so tests don't wait real time. */
	sleep?: (ms: number) => Promise<void>;
	/** Random in [0, 1). Injectable so tests get deterministic backoff. */
	random?: () => number;
}

const realSleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying on failure with full-jitter exponential backoff. The
 * backoff for attempt `i` (0-based) sleeps a random duration in
 * `[0, min(capMs, baseMs * 2 ** i))`, which spreads retries out under sustained
 * rate limiting. Stops as soon as `fn` resolves; rethrows the last error once
 * `attempts` is exhausted or `isRetryable` returns false.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	options: RetryOptions = {},
): Promise<T> {
	const {
		attempts = 3,
		baseMs = 1000,
		capMs = 8000,
		isRetryable = () => true,
		sleep = realSleep,
		random = Math.random,
	} = options;

	let lastError: unknown;
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		try {
			return await fn();
		} catch (error) {
			lastError = error;
			const isLast = attempt === attempts - 1;
			if (isLast || !isRetryable(error)) {
				throw error;
			}
			const ceiling = Math.min(capMs, baseMs * 2 ** attempt);
			await sleep(random() * ceiling);
		}
	}
	// Unreachable: the loop either returns or throws, but satisfies the type.
	throw lastError;
}
