import { type TriageStatus, triageStatusSchema } from "#/collections/items";

// The status-scoped feed nav: one tab per triage status, in workflow order
// (`new` first). Iterates the schema's options so the tabs stay in lockstep with
// the enum. Purely presentational — the route owns which status is active.
export function StatusFilter({
	value,
	onChange,
}: {
	value: TriageStatus;
	onChange: (next: TriageStatus) => void;
}) {
	return (
		<nav className="mb-6 inline-flex gap-1 rounded-lg bg-muted p-1">
			{triageStatusSchema.options.map((status) => (
				<button
					key={status}
					type="button"
					onClick={() => onChange(status)}
					className={`rounded-md px-3 py-1 font-medium text-sm capitalize transition-colors ${
						value === status
							? "bg-card text-foreground shadow-sm"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					{status}
				</button>
			))}
		</nav>
	);
}
