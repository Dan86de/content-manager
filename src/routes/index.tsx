import { eq, useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { itemsCollection, type TriageStatus } from "#/collections/items";
import type { CostSummary, OutcomeSummary } from "#/server/fetch";
import { fetchNow } from "#/server/fetch";
import type { PerSourceSummary } from "#/sources/types";
import { FeedTable } from "./-components/FeedTable";
import { RunSummary } from "./-components/RunSummary";
import { StatusFilter } from "./-components/StatusFilter";

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
	const [outcome, setOutcome] = useState<OutcomeSummary | null>(null);

	// Which triage status the feed is scoped to. Defaults to `new` — the
	// un-triaged Items — and switches to revisit kept / dismissed / drafted ones.
	const [status, setStatus] = useState<TriageStatus>("new");

	// The feed, scoped to the active status: most relevant first. Highest Score
	// on top, unscored Items last, newest-first within a tie. The status filter
	// and ordering live here in the live query, not in the Electric shape.
	const { data: items } = useLiveQuery(
		(q) =>
			q
				.from({ item: itemsCollection })
				.where(({ item }) => eq(item.status, status))
				.orderBy(({ item }) => item.score, {
					direction: "desc",
					nulls: "last",
				})
				.orderBy(({ item }) => item.published_at, "desc"),
		[status],
	);

	// Optimistically move an Item to a new triage status. TanStack DB applies the
	// change locally at once (the row leaves the current view) and persists it via
	// the collection's onUpdate handler, reconciling against Postgres through
	// Electric. Illegal transitions are rejected server-side and rolled back.
	function triage(id: string, next: TriageStatus) {
		itemsCollection.update(id, (draft) => {
			draft.status = next;
		});
	}

	// Drive the progress bar + cost panel off the event stream fetchNow returns.
	// The Scores themselves arrive separately, streamed into the feed by Electric.
	async function onFetchNow() {
		setIsFetching(true);
		setSummaries(null);
		setScoring(null);
		setCost(null);
		setOutcome(null);
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
						setOutcome(value.outcome);
						break;
				}
			}
		} finally {
			setIsFetching(false);
		}
	}

	return (
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

			<StatusFilter value={status} onChange={setStatus} />

			<RunSummary
				summaries={summaries}
				scoring={scoring}
				cost={cost}
				outcome={outcome}
			/>

			<FeedTable items={items} status={status} onTriage={triage} />
		</div>
	);
}
