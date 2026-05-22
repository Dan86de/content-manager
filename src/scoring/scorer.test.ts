import { describe, expect, it, vi } from "vitest";
import { parseScores, type ScoreCall, scoreItems } from "./scorer";
import type { ScorableItem } from "./types";

// Build n ScorableItems with sequential ids "1".."n".
function makeItems(n: number): ScorableItem[] {
	return Array.from({ length: n }, (_, i) => ({
		id: String(i + 1),
		title: `Item ${i + 1}`,
		url: `https://example.com/${i + 1}`,
		rawText: null,
	}));
}

describe("parseScores", () => {
	const sent = new Set(["1", "2"]);

	it("parses a clean JSON array", () => {
		const text = '[{"id":"1","score":9,"reason":"new agent capability"}]';
		expect(parseScores(text, sent)).toEqual([
			{ id: "1", score: 9, reason: "new agent capability" },
		]);
	});

	it("tolerates code fences and prose around the array", () => {
		const text =
			'Here are the scores:\n```json\n[{"id":"1","score":7,"reason":"ok"}]\n```\nDone.';
		expect(parseScores(text, sent)).toEqual([
			{ id: "1", score: 7, reason: "ok" },
		]);
	});

	it("coerces a stringified score and a numeric id", () => {
		const text = '[{"id":1,"score":"8","reason":"fine"}]';
		expect(parseScores(text, sent)).toEqual([
			{ id: "1", score: 8, reason: "fine" },
		]);
	});

	it("drops out-of-range and non-integer scores (no clamping)", () => {
		const text =
			'[{"id":"1","score":11,"reason":"too high"},{"id":"2","score":5.5,"reason":"fractional"}]';
		expect(parseScores(text, sent)).toEqual([]);
	});

	it("drops entries with an empty or whitespace reason", () => {
		const text =
			'[{"id":"1","score":6,"reason":""},{"id":"2","score":6,"reason":"   "}]';
		expect(parseScores(text, sent)).toEqual([]);
	});

	it("ignores ids that were not sent", () => {
		const text = '[{"id":"99","score":9,"reason":"unknown item"}]';
		expect(parseScores(text, sent)).toEqual([]);
	});

	it("keeps the first entry when an id is duplicated", () => {
		const text =
			'[{"id":"1","score":3,"reason":"first"},{"id":"1","score":9,"reason":"second"}]';
		expect(parseScores(text, sent)).toEqual([
			{ id: "1", score: 3, reason: "first" },
		]);
	});

	it("returns nothing when the whole response is unparseable", () => {
		expect(parseScores("the model refused", sent)).toEqual([]);
		expect(parseScores("[not valid json}", sent)).toEqual([]);
	});
});

describe("scoreItems", () => {
	it("splits into ~10-Item batches and yields one result set per batch", async () => {
		const items = makeItems(23);
		const seenBatchSizes: number[] = [];
		// Echo a valid score for every id the batch carried.
		const call: ScoreCall = vi.fn(async ({ user }) => {
			const ids = [...user.matchAll(/^id: (\d+)$/gm)].map((m) => m[1]);
			seenBatchSizes.push(ids.length);
			return JSON.stringify(
				ids.map((id) => ({ id, score: 5, reason: `reason ${id}` })),
			);
		});

		const batches: number[] = [];
		for await (const batch of scoreItems(items, "the niche", call)) {
			batches.push(batch.length);
		}

		expect(call).toHaveBeenCalledTimes(3);
		expect(seenBatchSizes).toEqual([10, 10, 3]);
		expect(batches).toEqual([10, 10, 3]);
	});

	it("maps results back by echoed id, never by position", async () => {
		const items = makeItems(2);
		// Respond out of order; the parser must still attach scores to the right id.
		const call: ScoreCall = async () =>
			'[{"id":"2","score":8,"reason":"second"},{"id":"1","score":3,"reason":"first"}]';

		const [batch] = await collect(scoreItems(items, "the niche", call));
		expect(batch).toEqual([
			{ id: "2", score: 8, reason: "second" },
			{ id: "1", score: 3, reason: "first" },
		]);
	});

	it("fails only the throwing batch and keeps scoring the rest", async () => {
		const items = makeItems(20);
		let calls = 0;
		const call: ScoreCall = async ({ user }) => {
			calls += 1;
			if (calls === 1) throw new Error("transport error");
			const ids = [...user.matchAll(/^id: (\d+)$/gm)].map((m) => m[1]);
			return JSON.stringify(
				ids.map((id) => ({ id, score: 5, reason: `reason ${id}` })),
			);
		};

		const batches = await collect(scoreItems(items, "the niche", call));
		expect(batches).toHaveLength(2);
		expect(batches[0]).toEqual([]); // transport error -> empty, retry next sweep
		expect(batches[1]).toHaveLength(10);
	});
});

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const out: T[] = [];
	for await (const value of gen) out.push(value);
	return out;
}
