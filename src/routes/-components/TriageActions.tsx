import type { TriageStatus } from "#/collections/items";

// The triage actions available from a row, per the state machine (ADR-0001):
// Keep shortlists a `new` Item; Dismiss removes a `new` or `kept` one. `drafted`
// and `dismissed` are terminal, so they offer no actions. The buttons sit above
// the row-spanning title link (z-10) so clicks reach them, not the link.
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
		<div className="relative z-10 flex justify-end gap-2">
			{canKeep && (
				<button
					type="button"
					onClick={onKeep}
					className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground text-xs hover:bg-secondary/80"
				>
					Keep
				</button>
			)}
			{canDismiss && (
				<button
					type="button"
					onClick={onDismiss}
					className="rounded-md px-2.5 py-1 font-medium text-muted-foreground text-xs hover:bg-muted-foreground/10 hover:text-foreground"
				>
					Dismiss
				</button>
			)}
		</div>
	);
}
