/**
 * Curated LLM model configuration. Edit this to change which Claude model a
 * pipeline tier uses.
 *
 * The id is checked against TanStack AI's `AnthropicChatModel` union, so a typo
 * or a model the adapter doesn't know about is a compile error. The drafting
 * model is intentionally absent until the drafting slice lands.
 */

import type { AnthropicChatModel } from "@tanstack/ai-anthropic";

/**
 * Model the Scorer rates Items with: high volume, must stay cheap and fast, so
 * the cheapest current Haiku. Scoring is plain (non-agentic) text, not tools.
 */
export const SCORING_MODEL: AnthropicChatModel = "claude-haiku-4-5";

/**
 * USD per million tokens for {@link SCORING_MODEL}, used to estimate a run's
 * cost from the token usage TanStack AI reports. TanStack AI ships pricing in
 * its types only, not at runtime, so it's mirrored here by hand — keep it in
 * step with the model's published rate (Haiku 4.5: $1 in / $5 out per MTok).
 */
export const SCORING_PRICE_USD_PER_MTOK = { input: 1, output: 5 } as const;
