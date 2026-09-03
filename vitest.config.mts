import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Cold parallel transforms on Windows can push the two broad router import
    // smoke tests beyond the default timeout. Keep a bounded ceiling without
    // making production code depend on test-runner contention.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 47,
        branches: 41,
        functions: 45,
        lines: 48,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
