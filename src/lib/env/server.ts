import "server-only";

import { z } from "zod";

import { normalizeEnvRecord } from "@/lib/env/normalize";
import { parseOrThrow } from "@/lib/validation";

/**
 * Server-only environment configuration.
 *
 * The `server-only` import above makes an accidental client import a build error.
 * Nothing in this module may be re-exported from `./public.ts`.
 *
 * Two rules govern everything here (docs/SECURITY.md §8 and §10):
 *
 * 1. **Nothing is required to build.** The application shell, the marketing-free first
 *    run, and the whole CI pipeline must work with an empty environment. Each variable
 *    is therefore optional at parse time, and the module that genuinely needs a value
 *    reports its absence at the moment of use (`requireDatabaseUrl()`,
 *    `requireSupabaseConfig()`) with an error that names the variable and never echoes
 *    its value.
 * 2. **Secrets are never public.** No database URL, service-role key, or provider key
 *    is prefixed `NEXT_PUBLIC_`; the browser receives no credential from this file.
 *
 * Phase 2 introduces the PostgreSQL and Supabase Auth variables below. Phase 3 adds the
 * BYOK encryption secret, and Phase 10 pins the deployment values.
 */
export const serverEnvSchema = z.object({
  /** Set by Next.js and by Vitest; validated so logging can be level-aware. */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Minimum level emitted by the server logger. */
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /**
   * Provided automatically by Vercel ("development" | "preview" | "production").
   * Unrecognised values degrade to `undefined` rather than failing a build,
   * because this variable is platform-owned and purely informational.
   */
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional().catch(undefined),

  /**
   * PostgreSQL connection string used by the server-side data layer.
   *
   * The transport is decided by the connection string itself: `sslmode=require` (and
   * stricter) for any hosted database, or a local socket/loopback address in
   * development. Never expose this value to the browser, a log, or an error message.
   */
  DATABASE_URL: z
    .string()
    .refine((value) => /^postgres(ql)?:\/\//i.test(value), {
      error: "must be a postgres:// or postgresql:// connection string",
    })
    .optional(),

  /**
   * Supabase project URL, for example `https://<project-ref>.supabase.co`.
   * Auth is the only thing Rowan uses Supabase for; data access is direct PostgreSQL.
   */
  SUPABASE_URL: z.url({ error: "must be an absolute URL" }).optional(),

  /**
   * Supabase anonymous (publishable) key. It is safe for Supabase's own access paths by
   * design — no row of Rowan's schema is readable with it, because no RLS policy grants
   * the `anon` role anything — but it still stays server-side, because only the server
   * needs it.
   */
  SUPABASE_ANON_KEY: z.string().min(16, { error: "is too short to be a Supabase key" }).optional(),

  /**
   * Supabase service-role key. Bypasses row-level security and can administer users.
   * Used only by the account-deletion path, only on the server, and never for reads or
   * writes that belong to an authenticated user.
   */
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(16, { error: "is too short to be a Supabase key" })
    .optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Parse a raw record (used directly by tests and by `getServerEnv`). */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return parseOrThrow(serverEnvSchema, normalizeEnvRecord(source), {
    label: "Server environment variables",
    code: "ENV_INVALID",
  });
}

let cachedServerEnv: ServerEnv | undefined;

/**
 * Validated server environment, parsed once per process.
 *
 * Read lazily (on first use) so that a missing variable fails the specific server
 * operation that needs it instead of breaking a build or a page that does not depend
 * on it.
 */
export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv({
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  return cachedServerEnv;
}

/** Discard the cached environment. Only tests need this. */
export function resetServerEnvCache(): void {
  cachedServerEnv = undefined;
}
