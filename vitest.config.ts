import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ mode }) => {
	// Vitest doesn't put .env values on process.env by default. Load them
	// explicitly (empty prefix = all keys) so TEST_DATABASE_URL from .env /
	// .env.local reaches both globalSetup (this main process) and the tests.
	const env = loadEnv(mode, process.cwd(), "");
	Object.assign(process.env, env);

	return {
		resolve: {
			alias: [
				{ find: /^#\/(.*)$/, replacement: `${src}/$1` },
				{ find: /^@\/(.*)$/, replacement: `${src}/$1` },
			],
		},
		test: {
			environment: "node",
			globalSetup: ["./src/test/global-setup.ts"],
			env,
		},
	};
});
