import { describe, expect, it } from "vitest";
import { estimateUsd } from "./cost";

describe("estimateUsd", () => {
	it("is zero when no tokens were used", () => {
		expect(estimateUsd(0, 0)).toBe(0);
	});

	it("prices input and output tokens at the configured per-MTok rate", () => {
		// Haiku 4.5: $1 / MTok input, $5 / MTok output.
		// 1,000,000 input + 200,000 output = $1 + $1 = $2.
		expect(estimateUsd(1_000_000, 200_000)).toBeCloseTo(2, 10);
	});
});
