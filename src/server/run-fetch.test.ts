import { describe, expect, it, vi } from "vitest";
import type { ScorableItem, ScoredBatch } from "#/scoring/types";
import type { NormalizedItem, PerSourceSummary } from "#/sources/types";
import type { FetchProgress } from "./fetch";
import { type RunFetchDeps, runFetch } from "./run-fetch";

// A single normalized Item; the orchestrator only cares about array length and
// passing it to insertNew, so the field values are filler.
function item(externalId: string): NormalizedItem {
	return {
		source: "fake",
		externalId,
		url: `https://example.com/${externalId}`,
		title: externalId,
		author: null,
		publishedAt: new Date("2026-01-01T00:00:00Z"),
		rawText: null,
	};
}

// A clean scored batch covering `sent` Items, all scored.
function scoredBatch(sent: number): ScoredBatch {
	return {
		scores: [],
		usage: { inputTokens: 10, outputTokens: 5 },
		sent,
		outcome: {
			scored: sent,
			omitted: 0,
			validationDropped: 0,
			parseFailed: 0,
			batchErrored: 0,
		},
	};
}

// Deps that touch nothing real: a niche string, no unscored Items, no scoring.
// Tests override just the slice they exercise.
function baseDeps(overrides: Partial<RunFetchDeps> = {}): RunFetchDeps {
	return {
		sources: [],
		insertNew: vi.fn(async (items: NormalizedItem[]) => items.length),
		scoreItems: async function* (_items: ScorableItem[], _niche: string) {},
		loadNiche: vi.fn(async () => "niche"),
		unscoredItems: vi.fn(async () => []),
		setScores: vi.fn(async () => {}),
		...overrides,
	};
}

async function collect(deps: RunFetchDeps): Promise<FetchProgress[]> {
	const events: FetchProgress[] = [];
	for await (const event of runFetch(deps)) {
		events.push(event);
	}
	return events;
}

function summariesOf(events: FetchProgress[]): PerSourceSummary[] {
	const done = events.find((e) => e.phase === "done");
	if (done?.phase !== "done") {
		throw new Error("run never reached the done event");
	}
	return done.summaries;
}

describe("runFetch fault isolation", () => {
	it("keeps fetching other Sources when one Source throws", async () => {
		const deps = baseDeps({
			sources: [
				{
					source: "broken",
					fetch: async () => {
						throw new Error("source on fire");
					},
				},
				{ source: "healthy", fetch: async () => [item("a"), item("b")] },
			],
		});

		const events = await collect(deps);
		const summaries = summariesOf(events);

		const broken = summaries.find((s) => s.source === "broken");
		const healthy = summaries.find((s) => s.source === "healthy");

		// The broken Source carries its failure; the healthy one still fetched
		// and inserted — one failure never aborts the run.
		expect(broken).toEqual({
			source: "broken",
			fetched: 0,
			inserted: 0,
			failed: true,
			error: "source on fire",
		});
		expect(healthy).toEqual({
			source: "healthy",
			fetched: 2,
			inserted: 2,
			failed: false,
		});
	});

	it("still reaches the done event when the scoring sweep throws", async () => {
		const deps = baseDeps({
			sources: [{ source: "healthy", fetch: async () => [item("a")] }],
			unscoredItems: vi.fn(async () => {
				throw new Error("db unreachable");
			}),
		});

		const events = await collect(deps);

		// The sweep failed, but the run completed: the healthy Source is summarized
		// and the terminal done event still lands.
		const done = events.find((e) => e.phase === "done");
		expect(done?.phase).toBe("done");
		expect(summariesOf(events)).toHaveLength(1);
	});

	it("aggregates per-run cost and outcome across scored batches", async () => {
		const deps = baseDeps({
			sources: [{ source: "healthy", fetch: async () => [item("a")] }],
			unscoredItems: vi.fn(async () => [
				{ id: "1", title: "t", url: "u", rawText: null },
			]),
			scoreItems: async function* () {
				yield scoredBatch(3);
				yield scoredBatch(2);
			},
		});

		const events = await collect(deps);
		const done = events.find((e) => e.phase === "done");
		if (done?.phase !== "done") {
			throw new Error("run never reached the done event");
		}

		expect(done.cost.batches).toBe(2);
		expect(done.cost.inputTokens).toBe(20);
		expect(done.cost.outputTokens).toBe(10);
		expect(done.outcome.total).toBe(5);
		expect(done.outcome.scored).toBe(5);
	});
});
