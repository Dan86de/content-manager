import { MoreHorizontal } from "lucide-react";
import type { TriageStatus } from "#/collections/items";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";

// The triage actions available from a row, per the state machine (ADR-0001):
// Keep shortlists a `new` Item; Dismiss removes a `new` or `kept` one. `drafted`
// and `dismissed` are terminal, so they offer no actions. A three-dots ghost
// button opens a contextual menu with the available actions; it sits above the
// row-spanning title link (z-10) so clicks reach it, not the link.
export function TriageActions({
	status,
	onKeep,
	onDismiss,
}: {
	status: TriageStatus;
	onKeep: () => void;
	onDismiss: () => void;
}) {
	const canKeep = status === "new";
	const canDismiss = status === "new" || status === "kept";
	if (!canKeep && !canDismiss) {
		return <span className="text-muted-foreground">—</span>;
	}
	return (
		<div className="relative z-10 flex justify-end">
			<DropdownMenu>
				<DropdownMenuTrigger
					className="relative inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted-foreground/10 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 data-[state=open]:bg-muted-foreground/10 data-[state=open]:text-foreground"
					aria-label="Triage actions"
				>
					<MoreHorizontal className="size-4" />
					<span
						className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
						aria-hidden="true"
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					{canKeep && (
						<DropdownMenuItem onSelect={onKeep}>Keep</DropdownMenuItem>
					)}
					{canDismiss && (
						<DropdownMenuItem variant="destructive" onSelect={onDismiss}>
							Dismiss
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
