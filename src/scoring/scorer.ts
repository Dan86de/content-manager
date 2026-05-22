import { chat } from "@tanstack/ai";
import { anthropicText } from "@tanstack/ai-anthropic";
import { z } from "zod";
import { SCORING_MODEL } from "../../models.config";
import type { ScorableItem, ScoreResult } from "./types";

/**
 * How many Items ride in one Haiku call. An internal Scorer detail, not user
 * configuration: small enough to keep each response parseable, large enough to
 * keep the call count (and cost) down.
 */
const SCORING_BATCH_SIZE = 10;

/** A single scoring call: takes the assembled prompt, returns raw model text. */
export type ScoreCall = (prompt: ScorePrompt) => Promise<string>;

/** The two halves of a scoring request handed to a {@link ScoreCall}. */
export interface ScorePrompt {
	/** The Niche spec plus the JSON output contract. */
	system: string;
	/** The batch of Items to score, one block each. */
	user: string;
}

/**
 * One entry in Haiku's response. `id` and `score` are coerced from the shapes a
 * model tends to drift into (a numeric id, a stringified score) but nothing is
 * clamped: an out-of-range or non-integer score fails validation and the Item
 * is left unscored to retry, rather than silently pinned to a boundary.
 */
const scoreEntrySchema = z.object({
	id: z.preprocess((v) => (typeof v === "number" ? String(v) : v), z.string()),
	score: z.preprocess(
		(v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
		z.number().int().min(0).max(10),
	),
	reason: z.string().trim().min(1),
});

/**
 * Pull a JSON array out of a model response, tolerating ```` ``` ```` fences and
 * prose around it by slicing from the first `[` to the last `]`. Returns null
 * when there is no bracketed span at all.
 */
function extractJsonArray(text: string): string | null {
	const unfenced = text.replace(/```(?:json)?/gi, "");
	const start = unfenced.indexOf("[");
	const end = unfenced.lastIndexOf("]");
	if (start === -1 || end === -1 || end < start) return null;
	return unfenced.slice(start, end + 1);
}

/**
 * Turn a raw Haiku response into Scores. Tolerant by design: strip fences/prose,
 * `JSON.parse`, then validate each entry. Malformed entries (bad score, empty
 * reason) are dropped so the Item stays `score IS NULL` and retries; entries for
 * ids that weren't sent are ignored; a duplicated id keeps the first; a wholly
 * unparseable response yields nothing (the whole batch retries).
 *
 * `sentIds` is the set of ids actually put in the prompt — results map back by
 * id, never by array position.
 */
export function parseScores(
	text: string,
	sentIds: ReadonlySet<string>,
): ScoreResult[] {
	const json = extractJsonArray(text);
	if (json === null) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];

	const seen = new Set<string>();
	const results: ScoreResult[] = [];
	for (const entry of parsed) {
		const result = scoreEntrySchema.safeParse(entry);
		if (!result.success) continue;
		const { id, score, reason } = result.data;
		if (!sentIds.has(id) || seen.has(id)) continue;
		seen.add(id);
		results.push({ id, score, reason });
	}
	return results;
}

/** Split a list into fixed-size chunks (the last one may be shorter). */
function chunk<T>(items: T[], size: number): T[][] {
	const batches: T[][] = [];
	for (let i = 0; i < items.length; i += size) {
		batches.push(items.slice(i, i + size));
	}
	return batches;
}

/** The Niche spec followed by the strict JSON contract Haiku must answer with. */
function buildSystemPrompt(niche: string): string {
	return `${niche}

---

## Output contract

You are scoring a batch of items. Return ONLY a JSON array — no prose, no code
fences — with one object per item you can confidently score:

[{ "id": "<the item's id, echoed exactly>", "score": <integer 0-10>, "reason": "<one short sentence>" }]

Echo each item's id exactly as given; map by id, never by position. Omit any
item you cannot score rather than guessing.`;
}

/** Render a batch as id-tagged blocks for the user turn. */
function buildUserPrompt(batch: ScorableItem[]): string {
	return batch
		.map((item) =>
			[
				`id: ${item.id}`,
				`title: ${item.title}`,
				`url: ${item.url}`,
				`text: ${item.rawText ?? "(none)"}`,
			].join("\n"),
		)
		.join("\n\n---\n\n");
}

/** The real scoring call: a plain, non-agentic Haiku text completion. */
const defaultCall: ScoreCall = ({ system, user }) =>
	chat({
		adapter: anthropicText(SCORING_MODEL),
		systemPrompts: [system],
		messages: [{ role: "user", content: user }],
		stream: false,
		maxTokens: 1024,
	});

/**
 * Score every Item against the Niche, yielding one batch of Scores at a time so
 * the orchestrator can persist each batch the moment it lands and Electric can
 * stream it into the feed.
 *
 * Fault containment lives inside the generator: a throwing batch would abort the
 * caller's `for await` and starve the remaining batches, so each batch's call is
 * wrapped — a transport error yields an empty batch and the loop moves on, and
 * those Items stay `score IS NULL` to retry next sweep.
 *
 * Pure aside from the injected `call` (defaulting to the real Haiku call), which
 * the parsing test replaces with a stub.
 */
export async function* scoreItems(
	items: ScorableItem[],
	niche: string,
	call: ScoreCall = defaultCall,
): AsyncGenerator<ScoreResult[]> {
	const system = buildSystemPrompt(niche);
	for (const batch of chunk(items, SCORING_BATCH_SIZE)) {
		const sentIds = new Set(batch.map((item) => item.id));
		try {
			const text = await call({ system, user: buildUserPrompt(batch) });
			yield parseScores(text, sentIds);
		} catch {
			yield [];
		}
	}
}
