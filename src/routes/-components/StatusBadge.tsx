import type { TriageStatus } from "#/collections/items";

// Triage status colors, driven by the theme tokens. Single taupe hue, so the
// new → kept → drafted progression is shown by increasing emphasis; dismissed
// is faded out.
const STATUS_STYLES: Record<TriageStatus, string> = {
	new: "bg-muted text-muted-foreground",
	kept: "bg-secondary text-secondary-foreground",
	drafted: "bg-primary text-primary-foreground",
	dismissed: "bg-transparent text-muted-foreground opacity-60",
};

export function StatusBadge({ status }: { status: TriageStatus }) {
	return (
		<span
			className={`rounded-md px-2 py-0.5 font-medium text-xs ${STATUS_STYLES[status]}`}
		>
			{status}
		</span>
	);
}
