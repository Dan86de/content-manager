import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./retry";

describe("withRetry", () => {
	// random() = 1 makes the sleep land on its ceiling, so the recorded delays
	// are the deterministic full-jitter upper bounds: baseMs, baseMs*2, ...
	const onCeiling = () => 1;

	it("returns the first result without sleeping when fn succeeds", async () => {
		const sleep = vi.fn(async (_ms: number) => {});
		const fn = vi.fn(async () => "ok");

		const result = await withRetry(fn, { sleep, random: onCeiling });

		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});

	it("retries with exponential backoff, then succeeds", async () => {
		const sleep = vi.fn(async (_ms: number) => {});
		const fn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("429"))
			.mockRejectedValueOnce(new Error("529"))
			.mockResolvedValueOnce("ok");

		const result = await withRetry(fn, {
			attempts: 3,
			baseMs: 1000,
			sleep,
			random: onCeiling,
		});

		expect(result).toBe("ok");
		expect(fn).toHaveBeenCalledTimes(3);
		// Two backoffs at their ceilings: baseMs, then baseMs * 2.
		expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 2000]);
	});

	it("caps the backoff at capMs", async () => {
		const sleep = vi.fn(async (_ms: number) => {});
		const fn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValueOnce(new Error("boom"))
			.mockRejectedValueOnce(new Error("boom"))
			.mockRejectedValueOnce(new Error("boom"))
			.mockResolvedValueOnce("ok");

		await withRetry(fn, {
			attempts: 4,
			baseMs: 1000,
			capMs: 1500,
			sleep,
			random: onCeiling,
		});

		// 1000, then min(1500, 2000)=1500, then min(1500, 4000)=1500.
		expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 1500, 1500]);
	});

	it("rethrows the last error once attempts are exhausted", async () => {
		const sleep = vi.fn(async (_ms: number) => {});
		const fn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValue(new Error("still failing"));

		await expect(
			withRetry(fn, { attempts: 3, sleep, random: onCeiling }),
		).rejects.toThrow("still failing");
		expect(fn).toHaveBeenCalledTimes(3);
		// Backoff sleeps only between attempts, never after the final one.
		expect(sleep).toHaveBeenCalledTimes(2);
	});

	it("does not retry when isRetryable rejects the error", async () => {
		const sleep = vi.fn(async (_ms: number) => {});
		const fn = vi
			.fn<() => Promise<string>>()
			.mockRejectedValue(new Error("not transient"));

		await expect(
			withRetry(fn, { isRetryable: () => false, sleep, random: onCeiling }),
		).rejects.toThrow("not transient");
		expect(fn).toHaveBeenCalledTimes(1);
		expect(sleep).not.toHaveBeenCalled();
	});
});
