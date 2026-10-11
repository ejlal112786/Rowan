/**
 * Database primitives shared by the runtime data layer, the migration runner, and
 * the integration tests.
 *
 * The central idea is that nothing in Rowan receives a raw connection. Callers get a
 * `Queryable` — a narrow interface with a *parameterised* query method — so every
 * statement in the codebase is parameterised by construction and can be driven by
 * different engines (node-postgres in the application, an injected client in tests).
 */

/** A row as returned by the driver, before it is validated into a domain object. */
export type DbRow = Record<string, unknown>;

export type QueryResult<Row extends DbRow = DbRow> = {
  rows: Row[];
  /** Rows affected by INSERT/UPDATE/DELETE; `null` for statements that report none. */
  rowCount: number | null;
};

/**
 * The only way Rowan talks to PostgreSQL.
 *
 * `params` are always sent out-of-band (`$1`, `$2`, …). Values are never
 * interpolated into SQL text — not even values Rowan itself generated.
 */
export type Queryable = {
  query<Row extends DbRow = DbRow>(
    text: string,
    params?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
};

/** Result of a statement that is only expected to affect rows. */
export type MutationResult = { rowCount: number };

/** UUID shape check used before an identifier is used as an owner filter. */
export const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
