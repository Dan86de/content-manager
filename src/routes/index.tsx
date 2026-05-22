import { useLiveQuery } from "@tanstack/react-db";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { itemsCollection } from "#/collections/items";
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

	// The feed: every Item, newest first. Ordering lives here, not in the shape.
	const { data: items } = useLiveQuery((q) =>
		q
			.from({ item: itemsCollection })
			.orderBy(({ item }) => item.published_at, "desc"),
	);

	async function onFetchNow() {
		setIsFetching(true);
		try {
			setSummaries(await runFetch());
		} finally {
			setIsFetching(false);
		}
	}

	return (
		<div className="mx-auto max-w-3xl p-8">
			<header className="mb-6 flex items-center justify-between">
				<h1 className="font-bold text-3xl">Feed</h1>
				<button
					type="button"
					onClick={onFetchNow}
					disabled={isFetching}
					className="rounded-md bg-black px-4 py-2 font-medium text-sm text-white disabled:opacity-50"
				>
					{isFetching ? "Fetching…" : "Fetch now"}
				</button>
			</header>

			{summaries && (
				<ul className="mb-6 space-y-1 text-gray-600 text-sm">
					{summaries.map((s) => (
						<li key={s.source}>
							<span className="font-medium">{s.source}</span>:{" "}
							{s.error
								? `failed — ${s.error}`
								: `fetched ${s.fetched}, inserted ${s.inserted}`}
						</li>
					))}
				</ul>
			)}

			{items.length === 0 ? (
				<p className="text-gray-500">No Items yet. Hit “Fetch now”.</p>
			) : (
				<ul className="space-y-4">
					{items.map((item) => (
						<li key={item.id} className="border-gray-100 border-b pb-4">
							<a
								href={item.url}
								target="_blank"
								rel="noreferrer"
								className="font-medium text-lg hover:underline"
							>
								{item.title}
							</a>
							<p className="mt-1 text-gray-500 text-sm">
								{item.source}
								{item.author ? ` · ${item.author}` : ""} ·{" "}
								{new Date(item.published_at).toLocaleString()}
							</p>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
