// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
    },
    ssr: {
        // Needed to fix mocking of 'node:fs' in tests
        noExternal: ["@rdfc/js-runner"],
    },
});
