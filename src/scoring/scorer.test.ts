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
	// Echo a valid score for every id in the batch, with a fixed token usage.
	const echoAll: ScoreCall = async ({ user }) => {
		const ids = [...user.matchAll(/^id: (\d+)$/gm)].map((m) => m[1]);
		return {
			text: JSON.stringify(
				ids.map((id) => ({ id, score: 5, reason: `reason ${id}` })),
			),
			usage: { inputTokens: 100, outputTokens: 20 },
		};
	};

	it("splits into ~10-Item batches and reports each batch's sent count", async () => {
		const call = vi.fn(echoAll);

		const batches = await collect(scoreItems(makeItems(23), "the niche", call));

		expect(call).toHaveBeenCalledTimes(3);
		expect(batches.map((b) => b.sent)).toEqual([10, 10, 3]);
		expect(batches.map((b) => b.scores.length)).toEqual([10, 10, 3]);
	});

	it("carries the call's token usage on each yielded batch", async () => {
		const [batch] = await collect(
			scoreItems(makeItems(2), "the niche", echoAll),
		);
		expect(batch.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
	});

	it("maps results back by echoed id, never by position", async () => {
		// Respond out of order; the parser must still attach scores to the right id.
		const call: ScoreCall = async () => ({
			text: '[{"id":"2","score":8,"reason":"second"},{"id":"1","score":3,"reason":"first"}]',
			usage: null,
		});

		const [batch] = await collect(scoreItems(makeItems(2), "the niche", call));
		expect(batch.scores).toEqual([
			{ id: "2", score: 8, reason: "second" },
			{ id: "1", score: 3, reason: "first" },
		]);
	});

	it("fails only the throwing batch and keeps scoring the rest", async () => {
		let calls = 0;
		const call: ScoreCall = async (prompt) => {
			calls += 1;
			if (calls === 1) throw new Error("transport error");
			return echoAll(prompt);
		};

		const batches = await collect(scoreItems(makeItems(20), "the niche", call));
		expect(batches).toHaveLength(2);
		// transport error -> no scores, no usage, but the batch is still accounted for
		expect(batches[0]).toEqual({ scores: [], usage: null, sent: 10 });
		expect(batches[1].scores).toHaveLength(10);
	});
});

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const out: T[] = [];
	for await (const value of gen) out.push(value);
	return out;
}
