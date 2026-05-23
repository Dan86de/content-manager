import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

	it("parses a clean JSON array and flags the unanswered id as omitted", () => {
		const text = '[{"id":"1","score":9,"reason":"new agent capability"}]';
		expect(parseScores(text, sent)).toEqual({
			scores: [{ id: "1", score: 9, reason: "new agent capability" }],
			parseFailed: false,
			validationDroppedIds: [],
			omittedIds: ["2"],
		});
	});

	it("tolerates code fences and prose around the array", () => {
		const text =
			'Here are the scores:\n```json\n[{"id":"1","score":7,"reason":"ok"}]\n```\nDone.';
		expect(parseScores(text, sent).scores).toEqual([
			{ id: "1", score: 7, reason: "ok" },
		]);
	});

	it("coerces a stringified score and a numeric id", () => {
		const text = '[{"id":1,"score":"8","reason":"fine"}]';
		expect(parseScores(text, sent).scores).toEqual([
			{ id: "1", score: 8, reason: "fine" },
		]);
	});

	it("records out-of-range and non-integer scores as validation-dropped", () => {
		const text =
			'[{"id":"1","score":11,"reason":"too high"},{"id":"2","score":5.5,"reason":"fractional"}]';
		const result = parseScores(text, sent);
		expect(result.scores).toEqual([]);
		expect(result.validationDroppedIds).toEqual(["1", "2"]);
		expect(result.omittedIds).toEqual([]);
	});

	it("records entries with an empty or whitespace reason as validation-dropped", () => {
		const text =
			'[{"id":"1","score":6,"reason":""},{"id":"2","score":6,"reason":"   "}]';
		const result = parseScores(text, sent);
		expect(result.scores).toEqual([]);
		expect(result.validationDroppedIds).toEqual(["1", "2"]);
	});

	it("ignores ids that were not sent and counts the sent ids as omitted", () => {
		const text = '[{"id":"99","score":9,"reason":"unknown item"}]';
		const result = parseScores(text, sent);
		expect(result.scores).toEqual([]);
		expect(result.omittedIds).toEqual(["1", "2"]);
		expect(result.validationDroppedIds).toEqual([]);
	});

	it("keeps the first entry when an id is duplicated", () => {
		const text =
			'[{"id":"1","score":3,"reason":"first"},{"id":"1","score":9,"reason":"second"}]';
		expect(parseScores(text, sent).scores).toEqual([
			{ id: "1", score: 3, reason: "first" },
		]);
	});

	it("lets a scored id win over an earlier malformed entry for the same id", () => {
		const text =
			'[{"id":"1","score":99,"reason":"bad"},{"id":"1","score":5,"reason":"good"}]';
		const result = parseScores(text, sent);
		expect(result.scores).toEqual([{ id: "1", score: 5, reason: "good" }]);
		expect(result.validationDroppedIds).toEqual([]);
		expect(result.omittedIds).toEqual(["2"]);
	});

	it("flags the whole batch as parseFailed when the response is unparseable", () => {
		const failed = {
			scores: [],
			parseFailed: true,
			validationDroppedIds: [],
			omittedIds: [],
		};
		expect(parseScores("the model refused", sent)).toEqual(failed);
		expect(parseScores("[not valid json}", sent)).toEqual(failed);
	});
});

describe("scoreItems", () => {
	// Quiet the per-batch console diagnostics the Scorer emits while sweeping.
	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "error").mockImplementation(() => {});
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

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

	it("splits into 5-Item batches and reports each batch's sent count", async () => {
		const call = vi.fn(echoAll);

		const batches = await collect(scoreItems(makeItems(23), "the niche", call));

		expect(call).toHaveBeenCalledTimes(5);
		expect(batches.map((b) => b.sent)).toEqual([5, 5, 5, 5, 3]);
		expect(batches.map((b) => b.scores.length)).toEqual([5, 5, 5, 5, 3]);
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

	it("reports an all-scored outcome for a clean batch", async () => {
		const [batch] = await collect(
			scoreItems(makeItems(2), "the niche", echoAll),
		);
		expect(batch.outcome).toEqual({
			scored: 2,
			omitted: 0,
			validationDropped: 0,
			parseFailed: 0,
			batchErrored: 0,
		});
	});

	it("counts Items the model dropped as omitted", async () => {
		const call: ScoreCall = async () => ({
			text: '[{"id":"1","score":5,"reason":"ok"}]',
			usage: null,
		});

		const [batch] = await collect(scoreItems(makeItems(2), "the niche", call));
		expect(batch.scores).toHaveLength(1);
		expect(batch.outcome).toEqual({
			scored: 1,
			omitted: 1,
			validationDropped: 0,
			parseFailed: 0,
			batchErrored: 0,
		});
	});

	it("counts the whole batch as parseFailed on an unparseable response", async () => {
		const call: ScoreCall = async () => ({
			text: "the model rambled with no array",
			usage: null,
		});

		const [batch] = await collect(scoreItems(makeItems(3), "the niche", call));
		expect(batch.scores).toEqual([]);
		expect(batch.outcome).toEqual({
			scored: 0,
			omitted: 0,
			validationDropped: 0,
			parseFailed: 3,
			batchErrored: 0,
		});
	});

	it("fails only the throwing batch and keeps scoring the rest", async () => {
		let calls = 0;
		const call: ScoreCall = async (prompt) => {
			calls += 1;
			if (calls === 1) throw new Error("transport error");
			return echoAll(prompt);
		};

		const batches = await collect(scoreItems(makeItems(20), "the niche", call));
		expect(batches).toHaveLength(4);
		// transport error -> no scores, no usage, the batch counted as batchErrored
		expect(batches[0]).toEqual({
			scores: [],
			usage: null,
			sent: 5,
			outcome: {
				scored: 0,
				omitted: 0,
				validationDropped: 0,
				parseFailed: 0,
				batchErrored: 5,
			},
		});
		expect(batches[1].scores).toHaveLength(5);
	});
});

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
	const out: T[] = [];
	for await (const value of gen) out.push(value);
	return out;
}
