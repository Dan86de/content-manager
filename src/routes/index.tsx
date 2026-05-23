import { useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { type CSSProperties, useState } from "react";
import { itemsCollection } from "#/collections/items";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import type { CostSummary } from "#/server/fetch";
import { fetchNow } from "#/server/fetch";
import type { PerSourceSummary } from "#/sources/types";

// The feed reads from a browser-only Electric collection (useLiveQuery), so
// there is nothing to server-render. Opt out of SSR for this route to avoid the
// "Missing getServerSnapshot" warning and the silent fallback to client render.
export const Route = createFileRoute("/")({ component: Feed, ssr: false });

function Feed() {
	const runFetch = useServerFn(fetchNow);
	const [isFetching, setIsFetching] = useState(false);
	const [summaries, setSummaries] = useState<PerSourceSummary[] | null>(null);
	const [scoring, setScoring] = useState<{
		processed: number;
		total: number;
	} | null>(null);
	const [cost, setCost] = useState<CostSummary | null>(null);

	// The feed: most relevant first. Highest Score on top, unscored Items last,
	// newest-first within a tie. Ordering lives here, not in the shape.
	const { data: items } = useLiveQuery((q) =>
		q
			.from({ item: itemsCollection })
			.orderBy(({ item }) => item.score, { direction: "desc", nulls: "last" })
			.orderBy(({ item }) => item.published_at, "desc"),
	);

	// Drive the progress bar + cost panel off the event stream fetchNow returns.
	// The Scores themselves arrive separately, streamed into the feed by Electric.
	async function onFetchNow() {
		setIsFetching(true);
		setSummaries(null);
		setScoring(null);
		setCost(null);
		const liveSummaries: PerSourceSummary[] = [];
		try {
			const stream = await runFetch();
			const reader = stream.getReader();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				switch (value.phase) {
					case "fetch":
						liveSummaries.push(value.summary);
						setSummaries([...liveSummaries]);
						break;
					case "score":
						setScoring({ processed: value.processed, total: value.total });
						break;
					case "done":
						setSummaries(value.summaries);
						setCost(value.cost);
						break;
				}
			}
		} finally {
			setIsFetching(false);
		}
	}

	return (
		<TooltipProvider>
			<div className="mx-auto max-w-5xl p-8">
				<header className="mb-6 flex items-center justify-between">
					<h1 className="font-bold text-3xl">Feed</h1>
					<button
						type="button"
						onClick={onFetchNow}
						disabled={isFetching}
						className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm disabled:opacity-50"
					>
						{isFetching ? "Fetching…" : "Fetch now"}
					</button>
				</header>

				{(summaries || scoring) && (
					<section className="mb-6 space-y-3 rounded-lg border border-border bg-card p-4">
						{summaries && (
							<ul className="space-y-1 text-muted-foreground text-sm">
								{summaries.map((s) => (
									<li key={s.source} className="flex items-baseline gap-x-2">
										<span className="font-medium text-foreground">
											{s.source}
										</span>
										{s.error ? (
											<span className="text-destructive">{s.error}</span>
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
				)}

				{items.length === 0 ? (
					<p className="text-muted-foreground">
						No Items yet. Hit “Fetch now”.
					</p>
				) : (
					<div className="-mx-8 -my-2 overflow-x-auto whitespace-nowrap">
						<div className="inline-block min-w-full px-8 py-2 align-middle">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-border border-b text-muted-foreground">
										<th className="whitespace-nowrap py-2 pr-4 font-medium">
											Title
										</th>
										<th className="whitespace-nowrap py-2 pr-4 font-medium">
											Source
										</th>
										<th className="whitespace-nowrap py-2 pr-4 font-medium">
											Author
										</th>
										<th className="whitespace-nowrap py-2 pr-4 font-medium">
											Published
										</th>
										<th className="whitespace-nowrap py-2 pr-4 font-medium">
											Status
										</th>
										<th className="whitespace-nowrap py-2 text-right font-medium">
											Score
										</th>
									</tr>
								</thead>
								<tbody>
									{items.map((item) => (
										<tr
											key={item.id}
											className="relative border-border border-b hover:bg-muted"
										>
											<td className="max-w-md py-3 pr-4">
												<a
													href={item.url}
													target="_blank"
													rel="noreferrer"
													className="font-medium text-foreground after:absolute after:inset-0 hover:underline"
												>
													<span className="block truncate">{item.title}</span>
												</a>
												{item.score_reason && (
													<Tooltip>
														<TooltipTrigger asChild>
															<a
																href={item.url}
																target="_blank"
																rel="noreferrer"
																className="relative z-10 block truncate text-muted-foreground text-xs hover:text-foreground"
															>
																{item.score_reason}
															</a>
														</TooltipTrigger>
														<TooltipContent
															side="bottom"
															align="start"
															className="max-w-md whitespace-normal text-sm"
														>
															{item.score_reason}
														</TooltipContent>
													</Tooltip>
												)}
											</td>
											<td className="py-3 pr-4">
												<span className="rounded-md bg-secondary px-2 py-0.5 font-medium text-secondary-foreground text-xs">
													{item.source}
												</span>
											</td>
											<td className="py-3 pr-4 text-muted-foreground">
												{item.author ?? "—"}
											</td>
											<td className="py-3 pr-4 text-muted-foreground">
												{new Date(item.published_at).toLocaleDateString()}
											</td>
											<td className="py-3 pr-4">
												<StatusBadge status={item.status} />
											</td>
											<td className="py-3 text-right text-foreground tabular-nums">
												{item.score ?? (
													<span className="text-muted-foreground">—</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>
		</TooltipProvider>
	);
}

// Triage status colors, driven by the theme tokens. Single taupe hue, so the
// new → kept → drafted progression is shown by increasing emphasis; dismissed
// is faded out.
const STATUS_STYLES: Record<string, string> = {
	new: "bg-muted text-muted-foreground",
	kept: "bg-secondary text-secondary-foreground",
	drafted: "bg-primary text-primary-foreground",
	dismissed: "bg-transparent text-muted-foreground opacity-60",
};

function StatusBadge({ status }: { status: string }) {
	const style = STATUS_STYLES[status] ?? "bg-muted text-muted-foreground";
	return (
		<span className={`rounded-md px-2 py-0.5 font-medium text-xs ${style}`}>
			{status}
		</span>
	);
}
