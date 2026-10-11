import { z } from "zod";

import { withSystemContext, type TransactionContext } from "@/lib/db/query";
import { requireOwner } from "@/lib/data/ownership";
import { AppError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";

/**
 * The account row (`public.users`).
 *
 * Rows are parsed before use: a database row is external input as far as TypeScript is
 * concerned, and a schema change that is not reflected here should fail loudly rather
 * than produce `undefined` deep inside the application.
 */

export const userRowSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  email_verified_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
  last_seen_at: z.date().nullable(),
});

export type UserRecord = z.infer<typeof userRowSchema>;

const USER_COLUMNS = "id, email, email_verified_at, created_at, updated_at, last_seen_at";

function parseUserRow(row: Record<string, unknown>): UserRecord {
  return parseOrThrow(userRowSchema, row, {
    label: "Account row",
    code: "INTERNAL",
  });
}

export type IdentityInput = {
  /** Provider user id. Must equal the authenticated owner of the transaction. */
  id: string;
  email: string;
  /** Provider-reported verification time, when the address has been confirmed. */
  emailVerifiedAt: Date | null;
};

/**
 * Create or refresh the account row for the authenticated user.
 *
 * Called on every authenticated request path that has just verified a user with the
 * provider, which makes it the provisioning path on databases without Supabase's
 * `auth` schema and a repair path on databases that have the trigger. It is written as
 * a single idempotent upsert so that concurrent requests cannot race into a duplicate
 * key error, and so it writes nothing when nothing changed.
 */
export async function ensureIdentity(
  context: TransactionContext,
  input: IdentityInput,
): Promise<UserRecord> {
  const ownerId = requireOwner(context);

  if (ownerId !== input.id) {
    throw new AppError(
      "Identity mismatch: the account being provisioned is not the authenticated user.",
      {
        code: "FORBIDDEN",
      },
    );
  }

  const result = await context.queryOne<Record<string, unknown>>(
    `insert into public.users (id, email, email_verified_at, last_seen_at)
     values ($1, lower($2), $3, now())
     on conflict (id) do update
        set email = excluded.email,
            email_verified_at = coalesce(excluded.email_verified_at, public.users.email_verified_at),
            last_seen_at = now()
      where public.users.email is distinct from excluded.email
         or public.users.email_verified_at is distinct from coalesce(excluded.email_verified_at, public.users.email_verified_at)
     returning ${USER_COLUMNS}`,
    [input.id, input.email, input.emailVerifiedAt],
  );

  if (result !== null) {
    return parseUserRow(result);
  }

  // No row returned: the account already existed with identical values, so the
  // conditional update matched nothing. Read it back inside the same transaction.
  const existing = await getAccount(context);

  if (existing === null) {
    throw new AppError("The account record could not be provisioned.", { code: "INTERNAL" });
  }

  return existing;
}

/** Read the authenticated account row. Returns `null` when it does not exist yet. */
export async function getAccount(context: TransactionContext): Promise<UserRecord | null> {
  const ownerId = requireOwner(context);

  const row = await context.queryOne<Record<string, unknown>>(
    `select ${USER_COLUMNS} from public.users where id = $1`,
    [ownerId],
  );

  return row === null ? null : parseUserRow(row);
}

/**
 * Refresh `last_seen_at`, at most once per interval.
 *
 * The interval keeps an authenticated read from turning into a write on every single
 * request while still giving the account surface a meaningfully recent timestamp.
 */
export async function touchLastSeen(
  context: TransactionContext,
  intervalSeconds = 300,
): Promise<void> {
  const ownerId = requireOwner(context);

  await context.mutate(
    `update public.users
        set last_seen_at = now()
      where id = $1
        and (last_seen_at is null or last_seen_at < now() - make_interval(secs => $2::double precision))`,
    [ownerId, intervalSeconds],
  );
}

/**
 * Delete every row Rowan owns for an account.
 *
 * **Privileged.** Runs in the system context because deletion must succeed regardless of
 * which rows exist, and because the account row intentionally has no `DELETE` policy for
 * the runtime role. Cascades remove the profile and the session records.
 *
 * Ordering matters at the call site (`src/lib/auth/account.ts`): the provider user is
 * deleted first, so the application can never be left able to authenticate a user whose
 * data is already gone.
 */
export async function deleteAccountRecords(userId: string): Promise<{ deleted: boolean }> {
  return withSystemContext(async (context) => {
    const result = await context.mutate("delete from public.users where id = $1", [userId]);

    return { deleted: result.rowCount > 0 };
  });
}
