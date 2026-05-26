import { LOOKBACK_HOURS } from "../../sources.config";
import type { NormalizedItem } from "./types";

/**
 * Keep only Items published within the last {@link LOOKBACK_HOURS} of `now`.
 * HackerNews filters its window API-side; YouTube and RSS hand back more than
 * 24h worth, so they apply this client-side cutoff. Items with an Invalid Date
 * (NaN time) fall out, since `NaN >= cutoff` is false.
 */
export function withinLookback(
	items: NormalizedItem[],
	now: Date,
): NormalizedItem[] {
	const cutoff = now.getTime() - LOOKBACK_HOURS * 3600 * 1000;
	return items.filter((item) => item.publishedAt.getTime() >= cutoff);
}
