import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
	resolve: {
		alias: [
			{ find: /^#\/(.*)$/, replacement: `${src}/$1` },
			{ find: /^@\/(.*)$/, replacement: `${src}/$1` },
		],
	},
	test: {
		environment: "node",
		globalSetup: ["./src/test/global-setup.ts"],
	},
});
