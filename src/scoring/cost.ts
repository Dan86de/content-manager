import { SCORING_PRICE_USD_PER_MTOK } from "../../models.config";

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
