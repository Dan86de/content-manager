import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { z } from "zod";
import { setItemStatus } from "#/server/triage";

/**
 * An Item as it arrives over the Electric shape (raw `items` row). Electric's
 * default parser yields numbers for integers and strings for everything else,
 * including the timestamptz columns.
 */
export const itemSchema = z.object({
	id: z.string(),
	source: z.string(),
	external_id: z.string(),
	url: z.string(),
	title: z.string(),
	author: z.string().nullable(),
	published_at: z.string(),
	raw_text: z.string().nullable(),
	status: z.string(),
	score: z.number().nullable(),
	score_reason: z.string().nullable(),
	draft_path: z.string().nullable(),
	created_at: z.string(),
});

export type Item = z.infer<typeof itemSchema>;

/**
 * Live collection backed by an Electric shape over the whole `items` table (all
 * columns, no WHERE). Ordering and every filter live in the TanStack DB live
 * query, not the shape. Reads hit Electric directly from the browser; the only
 * write is a triage `status` change, applied optimistically here and persisted
 * through the {@link setItemStatus} server function.
 */
export const itemsCollection = createCollection(
	electricCollectionOptions({
		id: "items",
		getKey: (item: Item) => item.id,
		schema: itemSchema,
		shapeOptions: {
			url: `${import.meta.env.VITE_ELECTRIC_URL}/v1/shape`,
			params: { table: "items" },
		},
		// The only mutation is a triage transition. Persist each changed Item's
		// new status and hand the write's txid back so Electric can discard the
		// optimistic state once that transaction streams in over the shape.
		onUpdate: async ({ transaction }) => {
			const txid = await Promise.all(
				transaction.mutations.map(async ({ key, modified }) => {
					const { txid } = await setItemStatus({
						data: { id: String(key), status: modified.status },
					});
					return txid;
				}),
			);
			return { txid };
		},
	}),
);
