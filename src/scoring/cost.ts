import { SCORING_PRICE_USD_PER_MTOK } from "../../models.config";
import type { BatchUsage } from "./types";

/** Tokens per million — the unit {@link SCORING_PRICE_USD_PER_MTOK} is quoted in. */
const TOKENS_PER_MTOK = 1_000_000;

/**
 * Estimate the USD cost of a scoring run from its token usage and the
 * configured per-MTok price. An estimate, not a billed figure: it counts plain
 * input/output tokens and ignores any cache or tier adjustments the provider
 * may apply.
 */
export function estimateUsd(inputTokens: number, outputTokens: number): number {
	return (
		(inputTokens / TOKENS_PER_MTOK) * SCORING_PRICE_USD_PER_MTOK.input +
		(outputTokens / TOKENS_PER_MTOK) * SCORING_PRICE_USD_PER_MTOK.output
	);
}

/**
 * Log one Claude call's token usage to the server console, so the cost of a
 * fetch (and later a draft) is visible per call, not just as a per-run total.
 * Local-only observability: nothing is persisted. A call that reported no usage
 * (e.g. one that errored before the provider returned counts) is skipped.
 */
export function logUsage(model: string, usage: BatchUsage | null): void {
	if (!usage) {
		return;
	}
	console.log("[usage]", {
		model,
		inputTokens: usage.inputTokens,
		outputTokens: usage.outputTokens,
		usd: estimateUsd(usage.inputTokens, usage.outputTokens),
	});
}
