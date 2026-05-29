import type { CSSProperties } from "react";
import type { CostSummary, OutcomeSummary } from "#/server/fetch";
import type { PerSourceSummary } from "#/sources/types";

// The four ways an Item can come back unscored, in the order they're worth
// noticing. Rendered as warning chips only when their count is > 0, so a clean
// run shows just "Scored X of Y" and nothing else.
const FAILURE_CATEGORIES = [
	{ key: "parseFailed", label: "parse-failed" },
	{ key: "batchErrored", label: "errored" },
	{ key: "omitted", label: "omitted" },
	{ key: "validationDropped", label: "validation-dropped" },
] as const satisfies ReadonlyArray<{
	key: keyof OutcomeSummary;
	label: string;
}>;

// The run/progress panel for a "Fetch now": per-Source fetch counts, the live
// scoring bar, the scored-of-total outcome with failure chips, and the cost
// line. Driven by the event stream the route reads; absent until a run starts.
export function RunSummary({
	summaries,
	scoring,
	cost,
	outcome,
}: {
	summaries: PerSourceSummary[] | null;
	scoring: { processed: number; total: number } | null;
	cost: CostSummary | null;
	outcome: OutcomeSummary | null;
}) {
	if (!summaries && !scoring) {
		return null;
	}

	return (
		<section className="mb-6 space-y-3 rounded-lg border border-border bg-card p-4">
			{summaries && (
				<ul className="space-y-1 text-muted-foreground text-sm">
					{summaries.map((s) => (
						<li key={s.source} className="flex items-baseline gap-x-2">
							<span className="font-medium text-foreground">{s.source}</span>
							{s.failed ? (
								<span className="text-destructive">{s.error ?? "failed"}</span>
							) : (
								<span className="tabular-nums">
									fetched {s.fetched}, inserted {s.inserted}
								</span>
							)}
						</li>
					))}
				</ul>
			)}

			{scoring && scoring.total > 0 && (
				<div>
					<div className="mb-1.5 flex items-baseline justify-between text-sm">
						<span className="font-medium text-foreground">Scoring</span>
						<span className="text-muted-foreground tabular-nums">
							{scoring.processed} / {scoring.total}
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full w-(--scoring-progress) rounded-full bg-primary transition-[width] duration-500 ease-out"
							style={
								{
									"--scoring-progress": `${(scoring.processed / scoring.total) * 100}%`,
								} as CSSProperties
							}
						/>
					</div>
				</div>
			)}

			{outcome && outcome.total > 0 && (
				<p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
					<span className="font-medium text-foreground tabular-nums">
						Scored {outcome.scored} of {outcome.total}
					</span>
					{FAILURE_CATEGORIES.map(({ key, label }) =>
						outcome[key] > 0 ? (
							<span
								key={key}
								className="rounded-md bg-destructive/10 px-2 py-0.5 font-medium text-destructive text-xs tabular-nums"
							>
								{outcome[key]} {label}
							</span>
						) : null,
					)}
				</p>
			)}

			{cost && cost.batches > 0 && (
				<p className="text-muted-foreground text-sm tabular-nums">
					Scored {cost.batches} batch{cost.batches === 1 ? "" : "es"} ·{" "}
					{cost.inputTokens.toLocaleString()} in /{" "}
					{cost.outputTokens.toLocaleString()} out tokens ·{" "}
					<span className="font-medium text-foreground">
						~${cost.usd.toFixed(4)}
					</span>
				</p>
			)}
		</section>
	);
}
