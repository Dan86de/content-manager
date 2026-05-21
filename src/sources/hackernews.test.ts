import { describe, expect, it } from "vitest";
import { HACKERNEWS } from "../../sources.config";
import fixture from "./__fixtures__/algolia-search.json";
import { type AlgoliaHit, normalizeHits } from "./hackernews";

describe("normalizeHits", () => {
	const hits = fixture.hits as AlgoliaHit[];
	const [linkPost, askHn] = normalizeHits(hits);

	it("maps a link post into the common shape", () => {
		expect(linkPost).toEqual({
			source: HACKERNEWS,
			externalId: "111",
			url: "https://example.com/claude-code-subagents",
			title: "Claude Code ships subagents",
			author: "alice",
			publishedAt: new Date(1716206400 * 1000),
			// Link posts have no body.
			rawText: null,
		});
	});

	it("falls back to the HN permalink when url is null (Ask HN)", () => {
		expect(askHn.url).toBe("https://news.ycombinator.com/item?id=222");
		expect(askHn.rawText).toBe(
			"I'm collecting MCP servers worth installing...",
		);
	});
});
