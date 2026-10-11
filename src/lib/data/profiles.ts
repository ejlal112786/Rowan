import { z } from "zod";

import type { TransactionContext } from "@/lib/db/query";
import { requireOwner } from "@/lib/data/ownership";
import { AppError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";

/**
 * The user-editable profile (`public.profiles`).
 *
 * Every statement filters by `user_id = <authenticated user>` *and* runs under a
 * transaction scoped to that user, so a cross-tenant read returns `null` and a
 * cross-tenant write affects zero rows. `tests/integration/ownership.test.ts` asserts
 * both.
 */

export const profileRowSchema = z.object({
  user_id: z.uuid(),
  display_name: z.string().nullable(),
  timezone: z.string().nullable(),
  bio: z.string().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type ProfileRecord = z.infer<typeof profileRowSchema>;

export type ProfileInput = {
  displayName: string | null;
  timezone: string | null;
  bio: string | null;
};

const PROFILE_COLUMNS = "user_id, display_name, timezone, bio, created_at, updated_at";

function parseProfileRow(row: Record<string, unknown>): ProfileRecord {
  return parseOrThrow(profileRowSchema, row, { label: "Profile row", code: "INTERNAL" });
}

/** Read the authenticated user's profile. */
export async function getProfile(context: TransactionContext): Promise<ProfileRecord | null> {
  const ownerId = requireOwner(context);

  const row = await context.queryOne<Record<string, unknown>>(
    `select ${PROFILE_COLUMNS} from public.profiles where user_id = $1`,
    [ownerId],
  );

  return row === null ? null : parseProfileRow(row);
}

/**
 * Read the profile, creating an empty one if it is missing.
 *
 * The database creates a profile with every account, so this only ever inserts when a
 * row was removed out of band. Keeping it idempotent means the settings surface can
 * always render.
 */
export async function ensureProfile(context: TransactionContext): Promise<ProfileRecord> {
  const existing = await getProfile(context);

  if (existing !== null) {
    return existing;
  }

  const ownerId = requireOwner(context);

  const row = await context.queryOne<Record<string, unknown>>(
    `insert into public.profiles (user_id) values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning ${PROFILE_COLUMNS}`,
    [ownerId],
  );

  if (row === null) {
    throw new AppError("The profile record could not be created.", { code: "INTERNAL" });
  }

  return parseProfileRow(row);
}

/**
 * Replace the editable profile fields.
 *
 * Zero affected rows means the caller does not own the profile — either it does not
 * exist or it belongs to someone else. Both are reported as `NOT_FOUND` so that a
 * cross-tenant probe cannot distinguish "not yours" from "does not exist".
 */
export async function updateProfile(
  context: TransactionContext,
  input: ProfileInput,
): Promise<ProfileRecord> {
  const ownerId = requireOwner(context);

  const row = await context.queryOne<Record<string, unknown>>(
    `update public.profiles
        set display_name = $2,
            timezone = $3,
            bio = $4
      where user_id = $1
      returning ${PROFILE_COLUMNS}`,
    [ownerId, input.displayName, input.timezone, input.bio],
  );

  if (row === null) {
    throw new AppError("That profile does not exist.", { code: "NOT_FOUND" });
  }

  return parseProfileRow(row);
}
