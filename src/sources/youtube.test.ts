import { describe, expect, it } from "vitest";
import { YOUTUBE } from "../../sources.config";
import fixture from "./__fixtures__/youtube-playlist-items.json";
import { withinLookback } from "./lookback";
import { normalizePlaylistItems, type PlaylistItem } from "./youtube";

const items = fixture.items as PlaylistItem[];

describe("normalizePlaylistItems", () => {
	const [video, , noOwner] = normalizePlaylistItems(items);

	it("maps an uploads entry into the common shape", () => {
		expect(video).toEqual({
			source: YOUTUBE,
			externalId: "vid111",
			url: "https://www.youtube.com/watch?v=vid111",
			title: "Building agents with the Claude Agent SDK",
			author: "Anthropic",
			// The video's publish time, not when it was added to the playlist.
			publishedAt: new Date("2024-05-20T12:00:00.000Z"),
			rawText: "A walkthrough of the Agent SDK.",
		});
	});

	it("falls back to null author and rawText when absent or empty", () => {
		expect(noOwner.author).toBeNull();
		expect(noOwner.rawText).toBeNull();
	});
});

describe("withinLookback on YouTube uploads", () => {
	// now is 12h after vid111, 18h after... vid333, 48h after vid222.
	const now = new Date("2024-05-21T00:00:00.000Z");

	it("keeps videos published within the window and drops older ones", () => {
		const recent = withinLookback(normalizePlaylistItems(items), now);
		expect(recent.map((item) => item.externalId)).toEqual(["vid111", "vid333"]);
	});
});
