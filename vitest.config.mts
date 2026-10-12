import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        // Catalog definitions are immutable. Every test owns its game state and controllers.
        isolate: false,
        include: ["src/tests/**/*.{test,spec}.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
        testTimeout: 30000,
        hookTimeout: 30000,
    },
});
