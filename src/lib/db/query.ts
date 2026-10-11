import "server-only";

import { getPool } from "@/lib/db/client";
import { toDatabaseAppError } from "@/lib/db/errors";
import { createPgQueryable } from "@/lib/db/pg";
import { isUuid, type DbRow, type Queryable } from "@/lib/db/types";
import { AppError } from "@/lib/errors";

/**
 * Transaction and ownership scoping for every database call.
 *
 * Rowan never runs a user-scoped statement on a bare pooled connection. Each one runs
 * inside a transaction that has been narrowed to:
 *
 *   SET LOCAL ROLE rowan_app              -- no table ownership, no BYPASSRLS
 *   SELECT set_config('app.user_id', $1, true)
 *
 * From that point the session cannot read or write another account's rows, because
 * the row-level security policies in `supabase/migrations/20261011120100_ownership_and_rls.sql`
 * compare `user_id` against `public.current_user_id()` — which reads the setting above.
 * If the setting is absent the comparison is NULL and the query matches nothing, so a
 * forgotten call denies access instead of exposing data.
 *
 * The role switch is applied with `SET LOCAL` inside a transaction, so it cannot leak
 * to the next caller of the same pooled connection.
 */

/** Runtime role defined by the ownership migration. Not configurable by design. */
export const RUNTIME_ROLE = "rowan_app" as const;

export type TransactionContext = {
  /**
   * Authenticated owner for this transaction, or `null` for the privileged system
   * context (which runs as the connection's own role).
   */
  userId: string | null;
  /** Parameterised query, targeting the configured database. */
  query: Queryable["query"];
  /** Run a statement expected to return at most one row. */
  queryOne: <Row extends DbRow = DbRow>(
    text: string,
    params?: readonly unknown[],
  ) => Promise<Row | null>;
  /** Run a statement that returns the number of affected rows. */
  mutate: (text: string, params?: readonly unknown[]) => Promise<{ rowCount: number }>;
};

function createContext(query: Queryable["query"], userId: string | null): TransactionContext {
  return {
    userId,
    query,
    async queryOne<Row extends DbRow = DbRow>(
      text: string,
      params?: readonly unknown[],
    ): Promise<Row | null> {
      const result = await query<Row>(text, params);
      return result.rows[0] ?? null;
    },
    async mutate(text: string, params?: readonly unknown[]) {
      const result = await query(text, params);
      return { rowCount: result.rowCount ?? 0 };
    },
  };
}

type TransactionOptions = {
  /** Owner id to scope the transaction to, validated before any SQL runs. */
  userId: string | null;
  /** Switch into the RLS-enforced runtime role. Only the system context skips it. */
  useRuntimeRole: boolean;
};

async function runTransaction<Result>(
  options: TransactionOptions,
  operation: (context: TransactionContext) => Promise<Result>,
): Promise<Result> {
  const client = await getPool()
    .connect()
    .catch((error: unknown) => {
      throw toDatabaseAppError(error);
    });

  const query = createPgQueryable(client);

  try {
    await query.query("begin");

    if (options.useRuntimeRole) {
      // Role name is a module constant, never user input. `SET` cannot take a
      // parameter, which is exactly why it is the one statement that is not
      // parameterised — and why nothing dynamic may be interpolated here.
      await query.query(`set local role ${RUNTIME_ROLE}`);
    }

    if (options.userId !== null) {
      // `set_config(..., is_local => true)` is the parameterisable form of `SET LOCAL`.
      await query.query("select set_config('app.user_id', $1, true)", [options.userId]);
    }

    const result = await operation(createContext(query.query, options.userId));

    await query.query("commit");

    return result;
  } catch (error) {
    try {
      await query.query("rollback");
    } catch {
      // A failed rollback means the connection is unusable; it is released below and
      // the original error is the one worth reporting.
    }

    throw toDatabaseAppError(error);
  } finally {
    client.release();
  }
}

/**
 * Run `operation` scoped to one authenticated owner.
 *
 * Everything the operation does is filtered by row-level security as that owner.
 * An invalid or missing owner id is refused before any statement is sent: the data
 * layer must not be able to run "unowned" by mistake.
 */
export async function withUserContext<Result>(
  userId: string,
  operation: (context: TransactionContext) => Promise<Result>,
): Promise<Result> {
  if (!isUuid(userId)) {
    throw new AppError("A valid account is required for this operation.", {
      code: "UNAUTHENTICATED",
      context: { reason: "invalid owner id" },
    });
  }

  return runTransaction({ userId, useRuntimeRole: true }, operation);
}

/**
 * Run `operation` as a privileged system transaction.
 *
 * This context does **not** set an owner and does **not** switch into the runtime
 * role, so it is not subject to owner policies. It exists only for operations that
 * legitimately span accounts — account deletion and maintenance — and every call site
 * must be justified in review. User-facing reads and writes must use
 * `withUserContext` instead.
 */
export async function withSystemContext<Result>(
  operation: (context: TransactionContext) => Promise<Result>,
): Promise<Result> {
  return runTransaction({ userId: null, useRuntimeRole: false }, operation);
}

/**
 * Whether the current transaction really is running as the RLS-enforced role.
 *
 * Used by integration tests to prove the enforcement path (rather than assuming it),
 * and available to health checks.
 */
export async function describeRuntimeContext(context: TransactionContext): Promise<{
  role: string;
  owner: string | null;
}> {
  const row = await context.queryOne<{ role: string; owner: string | null }>(
    `select current_user as role, public.current_user_id()::text as owner`,
  );

  return { role: row?.role ?? "unknown", owner: row?.owner ?? null };
}
