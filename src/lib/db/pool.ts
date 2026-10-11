import { Pool } from "pg";

/**
 * Pool construction shared by the application and by the migration CLI.
 *
 * This module deliberately has **no `server-only` import**: `scripts/db/migrate.ts` is a
 * deployment tool that runs outside the React Server Component graph, and `server-only`
 * refuses to load there. It also reads no environment variables — a connection string is
 * always passed in, so nothing here can pick up the wrong database implicitly.
 *
 * Pool sizing notes (why these numbers):
 *
 *   - `max: 5` — the deployment target is serverless, where every instance may open its own
 *     connections. Supabase's pooler multiplexes them; a large per-instance pool would
 *     exhaust the server's connection limit under load.
 *   - `statement_timeout` — a statement cannot hold a connection (and a transaction) open
 *     indefinitely.
 *   - `allowExitOnIdle` — a short-lived script (migrations, CI) exits without lingering.
 */

export const POOL_OPTIONS = {
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  allowExitOnIdle: true,
  statement_timeout: 10_000,
  application_name: "rowan",
} as const;

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, ...POOL_OPTIONS });
}
