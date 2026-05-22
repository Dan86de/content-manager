import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Read the Niche spec (`niche.md` at the repo root) fresh on every run, so
 * editing the file changes scoring without a code change or restart. Kept out
 * of the pure Scorer so the parsing test stays filesystem-free.
 */
export function loadNiche(): Promise<string> {
	return readFile(join(process.cwd(), "niche.md"), "utf8");
}
