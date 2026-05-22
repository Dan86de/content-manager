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
