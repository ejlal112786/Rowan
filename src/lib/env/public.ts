import { z } from "zod";

import { normalizeEnvRecord } from "@/lib/env/normalize";
import { parseOrThrow } from "@/lib/validation";

/**
 * Public (browser-visible) environment configuration.
 *
 * Only `NEXT_PUBLIC_*` variables may appear here — Next.js inlines these into
 * the client bundle at build time. Never add a private key, token, database
 * URL, or any other secret to this schema; put those in `./server.ts`.
 *
 * Variables are read through static `process.env.X` accesses (never dynamic
 * lookups) so Next.js can inline them correctly.
 */
export const publicEnvSchema = z.object({
  /**
   * Absolute, public origin of the deployment, used for absolute links and
   * metadata. Optional: the application shell must render without it.
   */
  NEXT_PUBLIC_APP_URL: z
    .url({ error: "must be an absolute URL, for example https://rowan.example.com" })
    .optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Parse a raw record (used directly by tests and by `getPublicEnv`). */
export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  return parseOrThrow(publicEnvSchema, normalizeEnvRecord(source), {
    label: "Public environment variables",
    code: "ENV_INVALID",
  });
}

let cachedPublicEnv: PublicEnv | undefined;

/** Validated public environment, parsed once per process. */
export function getPublicEnv(): PublicEnv {
  cachedPublicEnv ??= parsePublicEnv({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  return cachedPublicEnv;
}
