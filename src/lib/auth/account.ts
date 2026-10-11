import "server-only";

import { withUserContext } from "@/lib/db/query";
import { revokeOtherSessions } from "@/lib/data/sessions";
import { deleteAccountRecords } from "@/lib/data/users";
import { accountDeletionFailure } from "@/lib/auth/errors";
import { createSupabaseAdminClient } from "@/lib/auth/server-client";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Account deletion.
 *
 * A user asking to be deleted must leave nothing behind. Three steps, in this order:
 *
 *   1. **Revoke every session in Rowan.** The revocation list is checked on every
 *      authenticated request, so access ends immediately — even for a browser holding a
 *      token that has not expired.
 *   2. **Delete the provider user.** Credentials, refresh tokens, and identity records
 *      live with the provider; until it is deleted, the account could still sign in.
 *   3. **Delete Rowan's rows.** `public.users` cascades to the profile and every session
 *      record.
 *
 * If step 2 fails the operation stops and the account is left intact: a partially deleted
 * account that can still authenticate would be worse than a failed deletion, which the
 * user can retry. Step 3 failing after step 2 cannot let anyone back in — the provider
 * user is gone — so it is logged for an operator rather than surfaced as a failure.
 */

export type AccountDeletionResult = { deleted: true } | { deleted: false; message: string };

export async function deleteAccount(user: {
  id: string;
  sessionId: string | null;
}): Promise<AccountDeletionResult> {
  await withUserContext(user.id, async (context) => {
    await revokeOtherSessions(context, user.sessionId, "account-deleted");
  });

  const admin = createSupabaseAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error !== null && error.code !== "user_not_found") {
    const failure = accountDeletionFailure(error);

    logger.error("Account deletion failed at the provider step", {
      userId: user.id,
      providerCode: failure.providerCode,
      providerStatus: failure.providerStatus,
    });

    return { deleted: false, message: failure.message };
  }

  try {
    const { deleted } = await deleteAccountRecords(user.id);

    logger.info("Account deleted", { userId: user.id, recordsRemoved: deleted });
  } catch (error) {
    // The provider user is gone, so no authentication path remains. The residual rows are
    // an operator task, not a user-visible failure.
    logger.error("Account deleted at the provider but local rows remain", {
      userId: user.id,
      ...(error instanceof AppError ? { code: error.code } : {}),
    });
  }

  return { deleted: true };
}
