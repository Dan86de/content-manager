import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { RSS } from "../../sources.config";
import { withinLookback } from "./lookback";
import { normalizeRssItems, type RssEntry, rssParser } from "./rss";

const xml = readFileSync(
	fileURLToPath(new URL("./__fixtures__/feed.xml", import.meta.url)),
	"utf-8",
);

let entries: RssEntry[];

beforeAll(async () => {
	const feed = await rssParser.parseString(xml);
	entries = feed.items;
});

describe("normalizeRssItems", () => {
	it("maps a feed entry into the common shape, preferring the full body", () => {
		const [first] = normalizeRssItems(entries);
		expect(first).toEqual({
			source: RSS,
			externalId: "https://claudecodedaily.com/claude-code-tips",
			url: "https://claudecodedaily.com/claude-code-tips",
			title: "Claude Code tips for agents",
			author: "Dana",
			publishedAt: new Date("2024-05-20T12:00:00.000Z"),
			// content:encoded wins over the truncated description snippet.
			rawText: "<p>The full body of the article about agents.</p>",
		});
	});

	it("falls back to link when guid is missing", () => {
		const noGuid = normalizeRssItems(entries).find(
			(item) => item.title === "Entry without a guid",
		);
		expect(noGuid?.externalId).toBe("https://claudecodedaily.com/no-guid");
	});

	it("drops undated entries", () => {
		const titles = normalizeRssItems(entries).map((item) => item.title);
		expect(titles).not.toContain("Undated entry");
	});
});

describe("withinLookback on feed entries", () => {
	const now = new Date("2024-05-21T00:00:00.000Z");

	it("keeps recent entries and drops stale ones", () => {
		const recent = withinLookback(normalizeRssItems(entries), now);
		const titles = recent.map((item) => item.title);
		expect(titles).toContain("Claude Code tips for agents");
		expect(titles).toContain("Entry without a guid");
		expect(titles).not.toContain("Stale newsletter issue");
	});
});
