import "server-only";

import { z } from "zod";

import { normalizeEnvRecord } from "@/lib/env/normalize";
import { parseOrThrow } from "@/lib/validation";

/**
 * Server-only environment configuration.
 *
 * The `server-only` import above makes an accidental client import a build
 * error. Nothing in this module may be re-exported from `./public.ts`.
 *
 * Phase 1 requires no secrets: the application shell renders without a
 * database or AI provider credentials. Database and provider variables are
 * added to this schema in Phase 2 and Phase 3 respectively.
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
 * Read lazily (on first use) so that a missing variable fails the specific
 * server operation that needs it instead of breaking a build or a page that
 * does not depend on it.
 */
export function getServerEnv(): ServerEnv {
  cachedServerEnv ??= parseServerEnv({
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });

  return cachedServerEnv;
}
