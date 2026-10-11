/**
 * Test stub for the `server-only` marker package.
 *
 * `server-only` deliberately throws when it is imported outside a React Server
 * Component environment, which is exactly what we want in the application build
 * and never useful under Vitest. `vitest.config.ts` aliases the package to this
 * no-op module so server modules (validated env, logger) stay unit-testable
 * without weakening their build-time guarantee.
 */
export {};
