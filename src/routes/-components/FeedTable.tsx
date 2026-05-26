import type { Item, TriageStatus } from "#/collections/items";
import { TooltipProvider } from "#/components/ui/tooltip";
import { FeedRow } from "./FeedRow";

// The feed: the Items in the active status, or an empty-state line. Wraps the
// table in a TooltipProvider so each row's score-reason tooltip works. The route
// owns the live query and triage callback; this just renders what it's handed.
export function FeedTable({
	items,
	status,
	onTriage,
}: {
	items: Item[];
	status: TriageStatus;
	onTriage: (id: string, next: TriageStatus) => void;
}) {
	if (items.length === 0) {
		return (
			<p className="text-muted-foreground">
				{status === "new"
					? "No new Items. Hit “Fetch now”."
					: `No ${status} Items.`}
			</p>
		);
	}

	return (
		<TooltipProvider>
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
									Published
								</th>
								<th className="whitespace-nowrap py-2 pr-4 font-medium">
									Status
								</th>
								<th className="whitespace-nowrap py-2 pr-4 text-right font-medium">
									Score
								</th>
								<th className="whitespace-nowrap py-2 text-right font-medium">
									Actions
								</th>
							</tr>
						</thead>
						<tbody>
							{items.map((item) => (
								<FeedRow key={item.id} item={item} onTriage={onTriage} />
							))}
						</tbody>
					</table>
				</div>
			</div>
		</TooltipProvider>
	);
}
