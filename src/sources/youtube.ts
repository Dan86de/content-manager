import { YOUTUBE } from "../../sources.config";
import { withinLookback } from "./lookback";
import type { NormalizedItem } from "./types";

const PLAYLIST_ITEMS_URL =
	"https://www.googleapis.com/youtube/v3/playlistItems";
const WATCH_URL = "https://www.youtube.com/watch?v=";

/** One entry from `playlistItems.list` (only the fields we map). */
export interface PlaylistItem {
	snippet: {
		title: string;
		description: string;
		/** The channel that owns the video; null on deleted/private uploads. */
		videoOwnerChannelTitle?: string;
	};
	contentDetails: {
		videoId: string;
		/** The video's actual publish time (not when it was added to the playlist). */
		videoPublishedAt: string;
	};
}

interface PlaylistItemsResponse {
	items: PlaylistItem[];
}

/**
 * Map a single uploads-playlist entry into the common shape. Keyed by the
 * video id (not the playlist-item id), dated by the video's publish time, and
 * bodied by its description (empty descriptions collapse to null).
 */
export function normalizePlaylistItem(item: PlaylistItem): NormalizedItem {
	const { snippet, contentDetails } = item;
	return {
		source: YOUTUBE,
		externalId: contentDetails.videoId,
		url: `${WATCH_URL}${contentDetails.videoId}`,
		title: snippet.title,
		author: snippet.videoOwnerChannelTitle ?? null,
		publishedAt: new Date(contentDetails.videoPublishedAt),
		rawText: snippet.description || null,
	};
}

export function normalizePlaylistItems(
	items: PlaylistItem[],
): NormalizedItem[] {
	return items.map(normalizePlaylistItem);
}

/**
 * Fetch recent uploads for each configured channel over the last
 * {@link import("../../sources.config").LOOKBACK_HOURS}. A channel's uploads
 * playlist is its id with the leading `UC` swapped for `UU` — a zero-quota
 * transform that avoids a `channels.list` lookup. One single-page
 * `playlistItems.list` runs per channel (~1 quota unit); since entries come
 * back newest-first the 24h window is complete after the client-side cutoff.
 *
 * Empty `channels` returns `[]` before the key is read. With channels present
 * but `YOUTUBE_API_KEY` unset, it throws (the orchestrator surfaces it as the
 * Source's `error`). Each channel is an independent failure domain: one bad id
 * is skipped and logged, but if *every* attempted channel fails the aggregated
 * error is rethrown, so a dead run never reads as "nothing new in 24h".
 */
export async function fetchYouTube(
	channels: readonly string[],
	now: Date = new Date(),
): Promise<NormalizedItem[]> {
	if (channels.length === 0) {
		return [];
	}
	const apiKey = process.env.YOUTUBE_API_KEY;
	if (!apiKey) {
		throw new Error("YOUTUBE_API_KEY is not set");
	}

	const byId = new Map<string, NormalizedItem>();
	let failed = 0;

	for (const channelId of channels) {
		try {
			const playlistId = channelId.replace(/^UC/, "UU");
			const url = new URL(PLAYLIST_ITEMS_URL);
			url.searchParams.set("part", "snippet,contentDetails");
			url.searchParams.set("playlistId", playlistId);
			url.searchParams.set("maxResults", "50");
			url.searchParams.set("key", apiKey);

			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(
					`YouTube playlistItems failed for ${channelId}: ${response.status} ${response.statusText}`,
				);
			}
			const body = (await response.json()) as PlaylistItemsResponse;
			for (const item of withinLookback(
				normalizePlaylistItems(body.items),
				now,
			)) {
				byId.set(item.externalId, item);
			}
		} catch (error) {
			failed += 1;
			console.error(`YouTube channel ${channelId} skipped`, error);
		}
	}

	if (failed === channels.length) {
		throw new Error(`All ${channels.length} YouTube channels failed`);
	}

	return [...byId.values()];
}
