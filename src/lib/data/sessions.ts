import { z } from "zod";

import type { TransactionContext } from "@/lib/db/query";
import { requireOwner } from "@/lib/data/ownership";
import { AppError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";

/**
 * Session records and server-side revocation (`public.user_sessions`).
 *
 * The auth provider keeps the refresh token. Rowan keeps the *decision*: a session that
 * has been signed out or revoked here is refused on the next request even though its
 * access token has not expired yet. That is the difference between "the browser forgot
 * the cookie" and "the server withdrew access".
 *
 * Only the opaque provider session id is stored — never a token, never a refresh token.
 */

export const sessionRowSchema = z.object({
  session_id: z.string().min(1),
  user_id: z.uuid(),
  created_at: z.date(),
  last_seen_at: z.date(),
  revoked_at: z.date().nullable(),
  revoked_reason: z.string().nullable(),
  user_agent: z.string().nullable(),
});

export type SessionRecord = z.infer<typeof sessionRowSchema>;

export type SessionState = {
  /** Whether Rowan has seen this session before. */
  known: boolean;
  /** Whether the session was revoked here and must be refused. */
  revoked: boolean;
};

const SESSION_COLUMNS =
  "session_id, user_id, created_at, last_seen_at, revoked_at, revoked_reason, user_agent";

const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function parseSessionRow(row: Record<string, unknown>): SessionRecord {
  return parseOrThrow(sessionRowSchema, row, { label: "Session row", code: "INTERNAL" });
}

function assertSessionId(sessionId: string): string {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new AppError("The session identifier is not in a recognised format.", {
      code: "UNAUTHENTICATED",
      context: { reason: "malformed session id" },
    });
  }

  return sessionId;
}

/** Trim a user-agent string to what the schema stores, dropping control characters. */
export function normalizeUserAgent(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();

  return cleaned === "" ? null : cleaned.slice(0, 300);
}

/** Whether this session is known to Rowan, and whether it has been revoked. */
export async function getSessionState(
  context: TransactionContext,
  sessionId: string,
): Promise<SessionState> {
  const ownerId = requireOwner(context);

  const row = await context.queryOne<{ revoked_at: Date | null }>(
    `select revoked_at from public.user_sessions where session_id = $1 and user_id = $2`,
    [assertSessionId(sessionId), ownerId],
  );

  if (row === null) {
    return { known: false, revoked: false };
  }

  return { known: true, revoked: row.revoked_at !== null };
}

/**
 * Record a session Rowan has just issued or observed.
 *
 * Called on sign-in and on the first authenticated request of a session Rowan has not
 * seen before (for example one created by following an email link), so every live
 * session is visible in the account surface and individually revocable.
 */
export async function recordSession(
  context: TransactionContext,
  input: { sessionId: string; userAgent?: string | null },
): Promise<SessionRecord> {
  const ownerId = requireOwner(context);

  const row = await context.queryOne<Record<string, unknown>>(
    `insert into public.user_sessions (session_id, user_id, user_agent, last_seen_at)
     values ($1, $2, $3, now())
     on conflict (session_id) do update
        set last_seen_at = now(),
            user_agent = coalesce(excluded.user_agent, public.user_sessions.user_agent)
      where public.user_sessions.user_id = excluded.user_id
     returning ${SESSION_COLUMNS}`,
    [assertSessionId(input.sessionId), ownerId, normalizeUserAgent(input.userAgent)],
  );

  if (row === null) {
    // The conflict target existed but belonged to another account: the policy's
    // `with check` refused the update, so no row came back.
    throw new AppError("That session identifier is already in use.", { code: "CONFLICT" });
  }

  return parseSessionRow(row);
}

/** Refresh `last_seen_at`, at most once per interval. */
export async function touchSession(
  context: TransactionContext,
  sessionId: string,
  intervalSeconds = 300,
): Promise<void> {
  const ownerId = requireOwner(context);

  await context.mutate(
    `update public.user_sessions
        set last_seen_at = now()
      where session_id = $1
        and user_id = $2
        and revoked_at is null
        and last_seen_at < now() - make_interval(secs => $3::double precision)`,
    [assertSessionId(sessionId), ownerId, intervalSeconds],
  );
}

/** Revoke one session immediately. Idempotent: revoking twice affects one row once. */
export async function revokeSession(
  context: TransactionContext,
  sessionId: string,
  reason: string,
): Promise<{ revoked: boolean }> {
  const ownerId = requireOwner(context);

  const result = await context.mutate(
    `update public.user_sessions
        set revoked_at = now(),
            revoked_reason = $3
      where session_id = $1
        and user_id = $2
        and revoked_at is null`,
    [assertSessionId(sessionId), ownerId, reason.slice(0, 64)],
  );

  return { revoked: result.rowCount > 0 };
}

/**
 * Revoke every session except the one making the request.
 *
 * Used after a password change: the credential that could have been used to obtain
 * those sessions no longer exists, so the sessions it produced must not survive.
 */
export async function revokeOtherSessions(
  context: TransactionContext,
  keepSessionId: string | null,
  reason: string,
): Promise<{ revoked: number }> {
  const ownerId = requireOwner(context);

  const result = await context.mutate(
    `update public.user_sessions
        set revoked_at = now(),
            revoked_reason = $3
      where user_id = $1
        and revoked_at is null
        and ($2::text is null or session_id <> $2)`,
    [ownerId, keepSessionId === null ? null : assertSessionId(keepSessionId), reason.slice(0, 64)],
  );

  return { revoked: result.rowCount };
}

/** Every session Rowan knows about for the authenticated user, newest activity first. */
export async function listSessions(context: TransactionContext): Promise<SessionRecord[]> {
  const ownerId = requireOwner(context);

  const result = await context.query<Record<string, unknown>>(
    `select ${SESSION_COLUMNS}
       from public.user_sessions
      where user_id = $1
      order by revoked_at nulls first, last_seen_at desc
      limit 50`,
    [ownerId],
  );

  return result.rows.map(parseSessionRow);
}
