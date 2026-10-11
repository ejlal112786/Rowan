import type { Pool } from "pg";

import { createPool } from "@/lib/db/pool";
import { applyMigrations, loadMigrationsFromDirectory } from "@/lib/db/migrations";
import { createPgQueryable } from "@/lib/db/pg";
import type { Queryable } from "@/lib/db/types";

/**
 * Shared helpers for integration tests.
 *
 * The connection string comes from the environment: `tests/integration/global-setup.ts`
 * starts a throwaway PostgreSQL, applies every migration, and exports
 * `ROWAN_TEST_DATABASE_URL` (falling back to `TEST_DATABASE_URL`). Application code
 * under test reads the same value as `DATABASE_URL`, so the production query path
 * (`withUserContext`) is what the tests actually exercise — not a test-only shortcut.
 */

export const MIGRATIONS_DIRECTORY = new URL("../../supabase/migrations", import.meta.url).pathname;

export function testConnectionString(): string {
  const url = process.env.ROWAN_TEST_DATABASE_URL ?? process.env.DATABASE_URL;

  if (url === undefined || url.trim() === "") {
    throw new Error(
      "No test database configured. Run the integration project (tests/integration/global-setup.ts configures it).",
    );
  }

  return url;
}

/** A pool plus a `Queryable` for privileged test setup and assertions. */
export type TestDatabase = {
  pool: Pool;
  db: Queryable;
  close: () => Promise<void>;
};

export function connectTestDatabase(): TestDatabase {
  const pool = createPool(testConnectionString());

  return {
    pool,
    db: createPgQueryable(pool),
    close: async () => {
      await pool.end();
    },
  };
}

/** Apply every migration from the repository to the test database. */
export async function migrateTestDatabase(db: Queryable): Promise<void> {
  const migrations = await loadMigrationsFromDirectory(MIGRATIONS_DIRECTORY);
  await applyMigrations({ db, migrations });
}

/**
 * Return the database to its post-migration state.
 *
 * `drop schema public cascade` removes the tables *and* the grants and policies
 * attached to them, so each suite starts from exactly what the migrations produce. The
 * runtime role is dropped too, so the suite proves the migrations create it.
 */
export async function resetTestDatabase(db: Queryable): Promise<void> {
  await db.query("drop schema if exists public cascade");
  await db.query("create schema public");
  await db.query("drop role if exists rowan_app");
  await migrateTestDatabase(db);
}

export type SeededUser = {
  id: string;
  email: string;
};

/**
 * Insert an account row directly, bypassing the application.
 *
 * Used to arrange state that a second tenant owns — the whole point of the
 * cross-tenant tests is that the code under test can never create it.
 */
export async function seedUser(
  db: Queryable,
  input: { email: string; displayName?: string; verified?: boolean },
): Promise<SeededUser> {
  const id = crypto.randomUUID();

  await db.query("insert into public.users (id, email, email_verified_at) values ($1, $2, $3)", [
    id,
    input.email.toLowerCase(),
    input.verified === false ? null : new Date(),
  ]);

  if (input.displayName !== undefined) {
    await db.query("update public.profiles set display_name = $1 where user_id = $2", [
      input.displayName,
      id,
    ]);
  }

  return { id, email: input.email.toLowerCase() };
}

/**
 * Count rows in one of Rowan's tables as the privileged role — used to prove that a
 * write the application refused really did not happen. The table name is a literal
 * from the calling test, never external input.
 */
export async function countRows(
  db: Queryable,
  table: "users" | "profiles" | "user_sessions",
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `select count(*)::text as count from public.${table}`,
  );

  return Number(result.rows[0]?.count ?? "0");
}
