import { toDatabaseAppError } from "@/lib/db/errors";
import type { DbRow, Queryable, QueryResult } from "@/lib/db/types";

/**
 * Adapter that presents anything node-postgres-shaped (`Pool`, `PoolClient`, …) as a
 * `Queryable`.
 *
 * Shared by the runtime data layer, the migration runner, and the integration tests so
 * all three go through identical parameterisation and error classification.
 */

type PgQueryTarget = {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>;
};

export function createPgQueryable(target: PgQueryTarget): Queryable {
  return {
    async query<Row extends DbRow = DbRow>(
      text: string,
      params?: readonly unknown[],
    ): Promise<QueryResult<Row>> {
      try {
        const result = await target.query(text, params === undefined ? undefined : [...params]);

        return {
          rows: result.rows as Row[],
          rowCount: result.rowCount ?? null,
        };
      } catch (error) {
        // Classify here so callers handle one error type, and so a policy violation
        // can never be mistaken for an empty result.
        throw toDatabaseAppError(error);
      }
    },
  };
}
