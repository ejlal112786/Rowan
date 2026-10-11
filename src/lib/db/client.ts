import "server-only";

import type { Pool } from "pg";

import { createPool } from "@/lib/db/pool";
import { getServerEnv } from "@/lib/env/server";
import { AppError } from "@/lib/errors";

/**
 * PostgreSQL connection pool (server-only).
 *
 * Design notes:
 *
 * - **One pool per process.** The pool is cached on `globalThis` so Next.js dev-mode
 *   hot reloads reuse it instead of leaking connections on every recompile.
 * - **TLS comes from the connection string.** Rowan does not override transport
 *   security: `sslmode` in `DATABASE_URL` decides, which keeps hosted Supabase
 *   (`sslmode=require` on the pooler) and a local socket/`127.0.0.1` database on the
 *   same code path. Never lower this without changing the documented requirement in
 *   `docs/SECURITY.md`.
 * - **Small pool, short timeouts.** The deployment target is serverless, where each
 *   instance may hold a handful of connections; Supabase's pooler multiplexes them.
 *   A statement cannot occupy a connection indefinitely.
 * - **No connection is exposed.** Callers receive a `Queryable`, never the pool, so
 *   ownership scoping (`withUserContext`) cannot be bypassed by accident.
 */

const globalForPool = globalThis as typeof globalThis & {
  __rowanPool?: Pool | undefined;
};

/** True when a database is configured for this process. */
export function isDatabaseConfigured(): boolean {
  return getServerEnv().DATABASE_URL !== undefined;
}

/**
 * Connection string for the server-side data path.
 *
 * Throws a specific, safe error when the deployment is missing `DATABASE_URL`, so the
 * failure names the variable rather than surfacing as a driver crash.
 */
export function requireDatabaseUrl(): string {
  const connectionString = getServerEnv().DATABASE_URL;

  if (connectionString === undefined) {
    throw new AppError("This deployment is not connected to a database.", {
      code: "ENV_INVALID",
      context: { variable: "DATABASE_URL" },
    });
  }

  return connectionString;
}

/** The process-wide pool. Created on first use so a build needs no database. */
export function getPool(): Pool {
  globalForPool.__rowanPool ??= createPool(requireDatabaseUrl());

  return globalForPool.__rowanPool;
}

/** Release the pool. Used by tests and by graceful shutdown. */
export async function closePool(): Promise<void> {
  const pool = globalForPool.__rowanPool;

  if (pool === undefined) {
    return;
  }

  globalForPool.__rowanPool = undefined;
  await pool.end();
}
