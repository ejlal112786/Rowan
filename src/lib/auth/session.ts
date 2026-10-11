import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { isDatabaseConfigured } from "@/lib/db/client";
import { withUserContext } from "@/lib/db/query";
import { ensureProfile } from "@/lib/data/profiles";
import {
  getSessionState,
  normalizeUserAgent,
  recordSession,
  touchSession,
} from "@/lib/data/sessions";
import { ensureIdentity, touchLastSeen } from "@/lib/data/users";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { signInPathFor } from "@/lib/auth/redirects";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/auth/server-client";

/**
 * The thin server-side session interface.
 *
 * Everything in Rowan that needs to know *who is asking* goes through `getCurrentUser()`
 * or `requireUser()`; nothing else in the codebase reads an auth cookie, a token, or a
 * provider SDK. That is what keeps the provider replaceable and, more importantly, keeps
 * authorization decisions in one place: server-side, per request, derived from the
 * authenticated identity rather than from anything the client sent
 * (docs/ARCHITECTURE.md §4, docs/SECURITY.md §2–3).
 *
 * Resolution steps for a request, in order:
 *
 *   1. Ask the provider who the cookie belongs to (`getUser()` verifies the token with
 *      Supabase; a locally-decoded session is never trusted for identity).
 *   2. Read the session identifier from the verified token and check Rowan's own
 *      revocation list. A revoked session is refused even though the provider token is
 *      still valid — this is what makes "sign out everywhere" and password changes take
 *      effect immediately.
 *   3. Provision or refresh the account mirror and its profile, then record activity.
 *
 * Steps 2 and 3 run inside `withUserContext`, so every statement is filtered by row-level
 * security as that user.
 */

export type AuthenticatedUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  timezone: string | null;
  bio: string | null;
  /** Provider session id, used to revoke this session. `null` if it could not be read. */
  sessionId: string | null;
  accountCreatedAt: Date;
  lastSeenAt: Date | null;
};

export type SessionOutcome =
  | { status: "authenticated"; user: AuthenticatedUser }
  | { status: "anonymous" }
  /** The session was revoked in Rowan (signed out elsewhere, password change, deletion). */
  | { status: "revoked" }
  /** Authentication or the database is not configured for this deployment. */
  | { status: "unavailable"; missing: "auth" | "database" };

/** Session identifiers are opaque strings; this is the shape the schema accepts. */
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Read the session id from the provider's access token.
 *
 * Only the identifier is taken from the token, never identity data: identity comes from
 * `getUser()`, which the provider verifies. The id is used as a key into Rowan's own
 * revocation list, where row-level security means a value that did not belong to this
 * user could not affect another user's session anyway.
 */
export function readSessionIdFromAccessToken(accessToken: unknown): string | null {
  if (typeof accessToken !== "string") {
    return null;
  }

  const segments = accessToken.split(".");
  const payload = segments[1];

  if (segments.length !== 3 || payload === undefined) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"),
    ) as { session_id?: unknown };

    const sessionId = decoded.session_id;

    return typeof sessionId === "string" && SESSION_ID_PATTERN.test(sessionId) ? sessionId : null;
  } catch {
    return null;
  }
}

async function resolveSessionId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getSession();

  return readSessionIdFromAccessToken(data.session?.access_token);
}

/**
 * Resolve the current session. Cached per request, so a page that reads the user in a
 * layout, a page, and a component still asks the provider once.
 */
export const getSessionOutcome = cache(async (): Promise<SessionOutcome> => {
  if (!isAuthConfigured()) {
    return { status: "unavailable", missing: "auth" };
  }

  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();

  if (error !== null || data.user === null) {
    return { status: "anonymous" };
  }

  const providerUser = data.user;

  if (!isDatabaseConfigured()) {
    return { status: "unavailable", missing: "database" };
  }

  const sessionId = await resolveSessionId(client);
  const userAgent = normalizeUserAgent((await headers()).get("user-agent"));

  return withUserContext(providerUser.id, async (context) => {
    const sessionState = sessionId === null ? null : await getSessionState(context, sessionId);

    if (sessionState?.revoked === true) {
      // Fail closed: the provider would still accept this token.
      return { status: "revoked" } as const;
    }

    const account = await ensureIdentity(context, {
      id: providerUser.id,
      email: providerUser.email ?? "",
      emailVerifiedAt:
        providerUser.email_confirmed_at === undefined
          ? null
          : new Date(providerUser.email_confirmed_at),
    });

    const profile = await ensureProfile(context);

    if (sessionId !== null) {
      if (sessionState?.known === true) {
        await touchSession(context, sessionId);
      } else {
        // A session Rowan has not seen before — for example one created by following an
        // email link. Recording it makes it visible and revocable in account settings.
        await recordSession(context, { sessionId, userAgent });
      }
    }

    await touchLastSeen(context);

    return {
      status: "authenticated",
      user: {
        id: account.id,
        email: account.email,
        emailVerified: account.email_verified_at !== null,
        displayName: profile.display_name,
        timezone: profile.timezone,
        bio: profile.bio,
        sessionId,
        accountCreatedAt: account.created_at,
        lastSeenAt: account.last_seen_at,
      },
    } as const;
  });
});

/** The current user, or `null`. The one function feature code should call. */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const outcome = await getSessionOutcome();

  return outcome.status === "authenticated" ? outcome.user : null;
}

/**
 * Require an authenticated user, redirecting when there is none.
 *
 * Used by protected server components, so an unauthenticated visitor is sent to sign in
 * *before* any data is read. A revoked session is routed through the sign-out handler
 * first, which clears the now-useless cookies and explains why.
 */
export async function requireUser(
  returnTo: string = defaultAuthenticatedPath,
): Promise<AuthenticatedUser> {
  const outcome = await getSessionOutcome();

  switch (outcome.status) {
    case "authenticated":
      return outcome.user;
    case "revoked":
      redirect(
        `${authRoutes.signOutHandler}?next=${encodeURIComponent(signInPathFor(returnTo))}&reason=session-ended`,
      );
    case "unavailable":
      redirect(signInPathFor(returnTo));
    case "anonymous":
      redirect(signInPathFor(returnTo));
  }
}

/**
 * Whether the current visitor's session was revoked.
 *
 * Exposed for the sign-out handler, which needs to distinguish "revoked elsewhere" from
 * "already signed out" so the message it shows is accurate.
 */
export async function wasSessionRevoked(): Promise<boolean> {
  return (await getSessionOutcome()).status === "revoked";
}
