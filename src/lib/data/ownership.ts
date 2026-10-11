import type { TransactionContext } from "@/lib/db/query";
import { AppError } from "@/lib/errors";

/**
 * Ownership helpers used by every user-owned query.
 *
 * Rowan enforces ownership twice, and neither control is allowed to depend on the
 * other:
 *
 * 1. **Explicitly, in the query.** Every statement in `src/lib/data` carries
 *    `user_id = <authenticated user>` (or `id = …` for the account row). This is the
 *    filter the application is responsible for.
 * 2. **By the database.** Row-level security compares the same column against
 *    `public.current_user_id()`, which the transaction sets (`src/lib/db/query.ts`).
 *    This is the filter that still applies when a future query forgets control 1.
 *
 * The helpers here exist so that control 1 cannot be forgotten: the owner id is read
 * from the transaction context, never from a parameter, and it is validated before it
 * reaches SQL.
 */

/**
 * The authenticated owner for this transaction.
 *
 * Throws `UNAUTHENTICATED` when the context carries no owner — a user-scoped query can
 * therefore never accidentally run unowned (which, under the policies, would silently
 * return nothing).
 */
export function requireOwner(context: TransactionContext): string {
  if (context.userId === null) {
    throw new AppError("You must be signed in to do that.", { code: "UNAUTHENTICATED" });
  }

  return context.userId;
}

/**
 * Assert that a result set contains only rows owned by the authenticated user.
 *
 * Row-level security already guarantees this. The assertion turns a hypothetical
 * regression (a policy dropped, a connection running as the wrong role) into a loud
 * error instead of a quiet data leak, and the integration tests use it to prove the
 * guarantee holds for reads, too.
 */
export function assertOwnedRows<Row extends Record<string, unknown>>(
  rows: readonly Row[],
  ownerId: string,
  key: string = "user_id",
): void {
  for (const row of rows) {
    const rowOwner = row[key];

    if (rowOwner !== ownerId) {
      throw new AppError("A query returned a row owned by another account.", {
        code: "FORBIDDEN",
        context: { key },
      });
    }
  }
}
