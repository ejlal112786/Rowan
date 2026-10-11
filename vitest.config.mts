import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Vitest configuration for unit and component tests.
 *
 * - Two projects keep environments honest: `unit` runs in Node, `components`
 *   runs in jsdom with Testing Library set up.
 * - `resolve.tsconfigPaths` uses Vite's built-in `@/*` alias resolution, so no
 *   extra plugin is required.
 * - `server-only` is a marker package that throws by design outside a React
 *   Server Component environment. It is aliased to a no-op stub so server
 *   modules stay unit-testable without weakening their build-time guarantee.
 *
 * Browser-based end-to-end testing is intentionally deferred; see
 * docs/ROADMAP.md.
 */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./tests/support/server-only-stub.ts", import.meta.url)),
    },
  },
  test: {
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          environment: "jsdom",
          setupFiles: ["./tests/setup/component-setup.ts"],
          include: ["tests/components/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // One throwaway PostgreSQL serves the whole project, so files run in
          // sequence and share a connection budget instead of racing for ports.
          fileParallelism: false,
          globalSetup: ["./tests/integration/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 120_000,
        },
      },
    ],
  },
});
