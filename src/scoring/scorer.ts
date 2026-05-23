import { chat } from "@tanstack/ai";
import { anthropicText } from "@tanstack/ai-anthropic";
import { z } from "zod";
import { SCORING_MODEL } from "../../models.config";
import type {
	BatchOutcome,
	BatchUsage,
	ScorableItem,
	ScoredBatch,
	ScoreResult,
} from "./types";

/**
 * How many Items ride in one Haiku call. An internal Scorer detail, not user
 * configuration: small enough to keep each response parseable (a larger batch
 * risks the response truncating against `maxTokens` and losing the whole
 * batch), large enough to keep the call count (and cost) down.
 */
const SCORING_BATCH_SIZE = 5;

/** What a {@link ScoreCall} returns: the raw model text plus its token usage. */
export interface ScoreCallResult {
	text: string;
	usage: BatchUsage | null;
}

/** A single scoring call: takes the assembled prompt, returns text + usage. */
export type ScoreCall = (prompt: ScorePrompt) => Promise<ScoreCallResult>;

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
 * The result of parsing one batch's response: the Scores extracted, plus a
 * reconciliation of every sent id so the orchestrator can tell *why* an Item
 * went unscored. `parseFailed` means no JSON array could be recovered (e.g. the
 * response truncated mid-array) and every sent Item is a casualty; otherwise
 * each sent id is exactly one of scored / validation-dropped (an entry came
 * back but failed the schema) / omitted (no entry at all).
 */
export interface ParsedBatch {
	scores: ScoreResult[];
	/** True when no JSON array could be recovered: the whole batch is lost. */
	parseFailed: boolean;
	/** Sent ids whose entry came back but failed validation. */
	validationDroppedIds: string[];
	/** Sent ids absent from a successfully-parsed response. */
	omittedIds: string[];
}

/** Best-effort id off a raw entry, to attribute a validation drop to a sent Item. */
function looseId(entry: unknown): string | null {
	if (typeof entry !== "object" || entry === null) return null;
	const { id } = entry as { id?: unknown };
	if (typeof id === "string") return id;
	if (typeof id === "number") return String(id);
	return null;
}

const PARSE_FAILED: ParsedBatch = {
	scores: [],
	parseFailed: true,
	validationDroppedIds: [],
	omittedIds: [],
};

/**
 * Turn a raw Haiku response into a {@link ParsedBatch}. Tolerant by design:
 * strip fences/prose, `JSON.parse`, then validate each entry. Malformed entries
 * (bad score, empty reason) are dropped so the Item stays `score IS NULL` and
 * retries — and recorded under `validationDroppedIds` when their id is
 * recoverable; entries for ids that weren't sent are ignored; a duplicated id
 * keeps the first; a wholly unparseable response yields nothing and flags
 * `parseFailed` (the whole batch retries). Sent ids that never appeared land in
 * `omittedIds`.
 *
 * `sentIds` is the set of ids actually put in the prompt — results map back by
 * id, never by array position.
 */
export function parseScores(
	text: string,
	sentIds: ReadonlySet<string>,
): ParsedBatch {
	const json = extractJsonArray(text);
	if (json === null) return PARSE_FAILED;

	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return PARSE_FAILED;
	}
	if (!Array.isArray(parsed)) return PARSE_FAILED;

	const scoredIds = new Set<string>();
	const droppedIds = new Set<string>();
	const scores: ScoreResult[] = [];
	for (const entry of parsed) {
		const result = scoreEntrySchema.safeParse(entry);
		if (result.success) {
			const { id, score, reason } = result.data;
			if (!sentIds.has(id) || scoredIds.has(id)) continue;
			scoredIds.add(id);
			scores.push({ id, score, reason });
		} else {
			const id = looseId(entry);
			if (id !== null && sentIds.has(id)) droppedIds.add(id);
		}
	}

	// A sent id that scored wins over an earlier malformed entry for the same id.
	const validationDroppedIds = [...droppedIds].filter(
		(id) => !scoredIds.has(id),
	);
	const omittedIds = [...sentIds].filter(
		(id) => !scoredIds.has(id) && !droppedIds.has(id),
	);
	return { scores, parseFailed: false, validationDroppedIds, omittedIds };
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
fences — with exactly one object per item, in any order:

[{ "id": "<the item's id, echoed exactly>", "score": <integer 0-10>, "reason": "<one short sentence>" }]

Score every item — never omit one. An irrelevant or off-topic item is not
unscorable: give it a 0–2 per the Hard-no guidance above. When an item's text
is thin, score your best estimate from the title. Echo each item's id exactly
as given; map by id, never by position.`;
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

/**
 * The real scoring call: a plain, non-agentic Haiku text completion. A usage
 * middleware captures the token counts TanStack AI surfaces on the run's
 * `RUN_FINISHED` event (it fires even with `stream: false`) so the orchestrator
 * can total a per-run cost.
 */
const defaultCall: ScoreCall = async ({ system, user }) => {
	let usage: BatchUsage | null = null;
	const text = await chat({
		adapter: anthropicText(SCORING_MODEL),
		systemPrompts: [system],
		messages: [{ role: "user", content: user }],
		stream: false,
		maxTokens: 1024,
		middleware: [
			{
				name: "scoring-usage",
				onUsage: (_ctx, u) => {
					usage = {
						inputTokens: u.promptTokens,
						outputTokens: u.completionTokens,
					};
				},
			},
		],
	});
	return { text, usage };
};

/** A zero {@link BatchOutcome} with the given buckets filled in. */
function makeOutcome(partial: Partial<BatchOutcome>): BatchOutcome {
	return {
		scored: 0,
		omitted: 0,
		validationDropped: 0,
		parseFailed: 0,
		batchErrored: 0,
		...partial,
	};
}

/**
 * Dump a batch's raw model response and the sent-id→outcome reconciliation to
 * the server console — the local-only debugger for *why* Items go unscored. It
 * fires only when something went unscored (an `omitted`/`validationDropped`
 * list, or a `parseFailed` response), so a fully scored batch stays quiet. A
 * truncated response shows up here as `parseFailed: true` with the raw text cut
 * off mid-array; a model that just dropped Items shows up as a populated
 * `omitted` list against a clean response.
 */
function logBatch(
	sentIds: ReadonlySet<string>,
	text: string,
	parsed: ParsedBatch,
): void {
	if (
		!parsed.parseFailed &&
		parsed.omittedIds.length === 0 &&
		parsed.validationDroppedIds.length === 0
	) {
		return;
	}
	console.log("[scoring] batch", {
		sent: [...sentIds],
		parseFailed: parsed.parseFailed,
		scored: parsed.scores.map((s) => s.id),
		omitted: parsed.omittedIds,
		validationDropped: parsed.validationDroppedIds,
		rawResponse: text,
	});
}

/**
 * Score every Item against the Niche, yielding one batch at a time so the
 * orchestrator can persist each batch the moment it lands (Electric then streams
 * it into the feed) and advance a progress bar. Each yield carries the call's
 * token usage, how many Items it covered, and a {@link BatchOutcome} accounting
 * for why each Item did or didn't get a Score.
 *
 * Fault containment lives inside the generator: a throwing batch would abort the
 * caller's `for await` and starve the remaining batches, so each batch's call is
 * wrapped — a transport error yields no Scores (counted as `batchErrored`) and
 * the loop moves on, and those Items stay `score IS NULL` to retry next sweep.
 *
 * Pure aside from the injected `call` (defaulting to the real Haiku call), which
 * the parsing test replaces with a stub.
 */
export async function* scoreItems(
	items: ScorableItem[],
	niche: string,
	call: ScoreCall = defaultCall,
): AsyncGenerator<ScoredBatch> {
	const system = buildSystemPrompt(niche);
	for (const batch of chunk(items, SCORING_BATCH_SIZE)) {
		const sentIds = new Set(batch.map((item) => item.id));
		try {
			const { text, usage } = await call({
				system,
				user: buildUserPrompt(batch),
			});
			const parsed = parseScores(text, sentIds);
			logBatch(sentIds, text, parsed);
			const outcome = parsed.parseFailed
				? makeOutcome({ parseFailed: batch.length })
				: makeOutcome({
						scored: parsed.scores.length,
						omitted: parsed.omittedIds.length,
						validationDropped: parsed.validationDroppedIds.length,
					});
			yield { scores: parsed.scores, usage, sent: batch.length, outcome };
		} catch (error) {
			console.error("[scoring] batch errored", { sent: [...sentIds], error });
			yield {
				scores: [],
				usage: null,
				sent: batch.length,
				outcome: makeOutcome({ batchErrored: batch.length }),
			};
		}
	}
}
