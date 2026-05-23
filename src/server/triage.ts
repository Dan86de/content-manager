import { createServerFn } from "@tanstack/react-start";
import { setStatus } from "#/db/repository";

/** The triage transition a Keep / Dismiss action requests on one Item. */
interface SetItemStatusInput {
	id: string;
	status: string;
}

/**
 * Triage an Item: move it to a new `status`, enforcing the state machine in
 * {@link setStatus}. Returns the Postgres `txid` of the write so the optimistic
 * Electric collection mutation can reconcile once the change streams back.
 */
export const setItemStatus = createServerFn({ method: "POST" })
	.inputValidator((input: SetItemStatusInput) => input)
	.handler(async ({ data }): Promise<{ txid: number }> => {
		const txid = await setStatus(data.id, data.status);
		return { txid };
	});
