import type { Item, TriageStatus } from "#/collections/items";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "#/components/ui/tooltip";
import { StatusBadge } from "./StatusBadge";
import { TriageActions } from "./TriageActions";

// One Item in the feed table. The title is a row-spanning link (its overlay
// covers the whole row); the score reason, badge, and triage buttons sit above
// it (z-10) so they stay clickable. Bridges the route's id-keyed `onTriage` to
// the id-agnostic Keep / Dismiss callbacks TriageActions expects.
export function FeedRow({
	item,
	onTriage,
}: {
	item: Item;
	onTriage: (id: string, next: TriageStatus) => void;
}) {
	return (
		<tr className="relative border-border border-b hover:bg-muted">
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
				{new Date(item.published_at).toLocaleDateString()}
			</td>
			<td className="py-3 pr-4">
				<StatusBadge status={item.status} />
			</td>
			<td className="py-3 pr-4 text-right text-foreground tabular-nums">
				{item.score ?? <span className="text-muted-foreground">—</span>}
			</td>
			<td className="py-3 text-right">
				<TriageActions
					status={item.status}
					onKeep={() => onTriage(item.id, "kept")}
					onDismiss={() => onTriage(item.id, "dismissed")}
				/>
			</td>
		</tr>
	);
}
