import { afterEach, describe, expect, it, vi } from "vitest";
import { estimateUsd, logUsage } from "./cost";

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

describe("logUsage", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("logs the model, token counts, and estimated USD for a call", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		logUsage("claude-haiku-4-5", { inputTokens: 1_000_000, outputTokens: 0 });

		expect(log).toHaveBeenCalledTimes(1);
		expect(log).toHaveBeenCalledWith("[usage]", {
			model: "claude-haiku-4-5",
			inputTokens: 1_000_000,
			outputTokens: 0,
			usd: 1,
		});
	});

	it("logs nothing when the call reported no usage", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		logUsage("claude-haiku-4-5", null);

		expect(log).not.toHaveBeenCalled();
	});
});
