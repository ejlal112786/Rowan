import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { authCookieOptions } from "@/lib/auth/cookie-options";
import { getServerEnv } from "@/lib/env/server";
import { AppError } from "@/lib/errors";

/**
 * Supabase clients used on the server.
 *
 * Supabase Auth is kept behind this module and `session.ts`: no feature code imports the
 * provider SDK directly, so replacing it later means rewriting these files rather than
 * every page (docs/ARCHITECTURE.md §4).
 *
 * Cookie policy — the whole reason this file is worth reading:
 *
 *   - Session cookies are **`httpOnly`**: no script can read them, so an injected script
 *     cannot exfiltrate a session. Nothing about the session is ever written to
 *     `localStorage`, which is what makes XSS survivable.
 *   - `secure` in production, `sameSite: "lax"` everywhere (the auth flows are top-level
 *     navigations from email links, which `"strict"` would break).
 *   - A **new client is created per request**. @supabase/ssr relies on the cookie adapter
 *     to persist refreshed tokens; a long-lived client would write one user's tokens into
 *     another user's response.
 */

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

/** Whether authentication is configured for this deployment. */
export function isAuthConfigured(): boolean {
  const env = getServerEnv();

  return env.SUPABASE_URL !== undefined && env.SUPABASE_ANON_KEY !== undefined;
}

/** Authentication configuration, or a specific error naming what is missing. */
export function requireSupabaseConfig(): SupabaseConfig {
  const env = getServerEnv();
  const missing = [
    env.SUPABASE_URL === undefined ? "SUPABASE_URL" : null,
    env.SUPABASE_ANON_KEY === undefined ? "SUPABASE_ANON_KEY" : null,
  ].filter((value): value is string => value !== null);

  if (missing.length > 0 || env.SUPABASE_URL === undefined || env.SUPABASE_ANON_KEY === undefined) {
    throw new AppError("Authentication is not configured for this deployment.", {
      code: "ENV_INVALID",
      context: { missing },
    });
  }

  return { url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY };
}

// The cookie policy is shared with the proxy; see src/lib/auth/cookie-options.ts.

/**
 * Server-side Supabase client bound to the request's cookies.
 *
 * In a Server Component Next.js forbids writing cookies, and @supabase/ssr may attempt a
 * token refresh. The write is therefore allowed to fail there (`try/catch` with a
 * comment): the proxy refreshes and persists the session before the component runs, so
 * by the time this client is used the token is already fresh. Silently ignoring the
 * failure is safe — the session is never *created* here, only refreshed.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const config = requireSupabaseConfig();
  const cookieStore = await cookies();
  const options = authCookieOptions();

  return createServerClient(config.url, config.anonKey, {
    cookieOptions: { ...options },
    cookies: {
      getAll() {
        return cookieStore.getAll().map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
        }));
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            cookieStore.set(cookie.name, cookie.value, { ...cookie.options, ...options });
          }
        } catch {
          // Server Component: cookies are read-only here. The proxy already persisted
          // the refreshed session for this request.
        }
      },
    },
  });
}

/**
 * Administrative client, authenticated with the service-role key.
 *
 * Holds privileges that bypass row-level security, so it is used for exactly one
 * operation — deleting the provider-side user during account deletion
 * (`src/lib/auth/account.ts`) — and it is never used to read or write user data.
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const env = getServerEnv();
  const config = requireSupabaseConfig();

  if (env.SUPABASE_SERVICE_ROLE_KEY === undefined) {
    throw new AppError("Account deletion requires SUPABASE_SERVICE_ROLE_KEY to be configured.", {
      code: "ENV_INVALID",
      context: { variable: "SUPABASE_SERVICE_ROLE_KEY" },
    });
  }

  return createClient(config.url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
