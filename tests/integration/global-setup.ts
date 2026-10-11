import { connectTestDatabase, migrateTestDatabase } from "../support/database";
import { startPostgres } from "../support/postgres";

/**
 * Starts the integration database once for the whole project.
 *
 * The application's data layer reads `DATABASE_URL` through its validated environment
 * schema, so the test database is exported under exactly that name: the integration
 * tests therefore run the real `withUserContext` path against a real PostgreSQL rather
 * than a harness-specific substitute.
 *
 * `TEST_DATABASE_URL` takes precedence and is used as-is (CI service container, local
 * PostgreSQL). Otherwise a throwaway cluster is started from the bundled binaries.
 *
 * If no database can be started, the suite fails loudly when running in CI — silently
 * skipping tenant-isolation coverage would be worse than a red build — and skips with a
 * printed reason locally.
 */
export default async function setup(): Promise<() => Promise<void>> {
  try {
    const server = await startPostgres();

    process.env.DATABASE_URL = server.connectionString;
    process.env.ROWAN_TEST_DATABASE_URL = server.connectionString;
    delete process.env.ROWAN_TEST_DATABASE_SKIP;

    const database = connectTestDatabase();

    try {
      await migrateTestDatabase(database.db);
    } finally {
      await database.close();
    }

    console.log(
      `\n[integration] PostgreSQL ready (${server.external ? "TEST_DATABASE_URL" : "ephemeral cluster"}); migrations applied.\n`,
    );

    return async () => {
      await server.stop();
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    if (process.env.CI !== undefined && process.env.CI !== "") {
      throw new Error(
        `Integration database unavailable in CI and no TEST_DATABASE_URL was provided: ${reason}`,
      );
    }

    process.env.ROWAN_TEST_DATABASE_SKIP = reason;
    console.warn(
      `\n[integration] No PostgreSQL available (${reason}).\n[integration] Integration tests will be skipped. Set TEST_DATABASE_URL to run them.\n`,
    );

    return async () => {};
  }
}
