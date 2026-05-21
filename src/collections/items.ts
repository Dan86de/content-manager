import { electricCollectionOptions } from "@tanstack/electric-db-collection";
import { createCollection } from "@tanstack/react-db";
import { z } from "zod";

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
 * Live, read-only collection backed by an Electric shape over the whole `items`
 * table (all columns, no WHERE). Ordering and every future filter live in the
 * TanStack DB live query, not the shape. Reads hit Electric directly from the
 * browser; all writes go through server functions.
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
	}),
);
