import { type TriageStatus, triageStatusSchema } from "#/collections/items";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";

// The status-scoped feed picker: one option per triage status, in workflow order
// (`new` first). Iterates the schema's options so the choices stay in lockstep
// with the enum. Purely presentational — the route owns which status is active.
export function StatusFilter({
	value,
	onChange,
}: {
	value: TriageStatus;
	onChange: (next: TriageStatus) => void;
}) {
	return (
		<Select
			value={value}
			onValueChange={(next) => onChange(next as TriageStatus)}
		>
			<SelectTrigger className="mb-6 w-44 capitalize">
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{triageStatusSchema.options.map((status) => (
					<SelectItem key={status} value={status} className="capitalize">
						{status}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
