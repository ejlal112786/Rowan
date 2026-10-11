import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyMigrations,
  checksumSql,
  loadMigrationsFromDirectory,
  planMigrations,
  readAppliedMigrations,
} from "@/lib/db/migrations";
import {
  connectTestDatabase,
  MIGRATIONS_DIRECTORY,
  resetTestDatabase,
  type TestDatabase,
} from "../support/database";

/**
 * Migration system, verified against a real PostgreSQL.
 *
 * These tests are the reason the project can claim "migrations apply cleanly from an
 * empty database": they drop the schema, apply every migration through the same runner
 * the CLI uses, and then inspect the resulting catalogue to confirm the security
 * properties the application depends on actually exist in the database.
 */

const skipReason = process.env.ROWAN_TEST_DATABASE_SKIP;

if (skipReason !== undefined) {
  // Printed rather than silent: an integration suite that quietly disappears is a
  // false signal of coverage.
  console.warn(
    `[integration] migrations.test.ts skipped: ${skipReason}. Set TEST_DATABASE_URL or run on a supported platform.`,
  );
}

describe.skipIf(skipReason !== undefined)("migrations", () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = connectTestDatabase();
    await resetTestDatabase(database.db);
  });

  afterAll(async () => {
    await database.close();
  });

  it("applies every migration from an empty database and records each one", async () => {
    const migrations = await loadMigrationsFromDirectory(MIGRATIONS_DIRECTORY);
    const applied = await readAppliedMigrations(database.db);

    expect(migrations.length).toBeGreaterThanOrEqual(3);
    expect(applied.map((row) => row.name)).toEqual(migrations.map((row) => row.name));
  });

  it("is idempotent: a second run applies nothing", async () => {
    const migrations = await loadMigrationsFromDirectory(MIGRATIONS_DIRECTORY);
    const report = await applyMigrations({ db: database.db, migrations });

    expect(report.applied).toEqual([]);
    expect(report.skipped).toHaveLength(migrations.length);
  });

  it("detects an edited migration instead of silently re-applying it", async () => {
    const migrations = await loadMigrationsFromDirectory(MIGRATIONS_DIRECTORY);
    const [first] = migrations;
    expect(first).toBeDefined();
    if (first === undefined) return;

    const tampered = {
      ...first,
      sql: `${first.sql}\n-- edited after being applied`,
      checksum: checksumSql(`${first.sql}\n-- edited after being applied`),
    };

    const plan = planMigrations(
      [tampered, ...migrations.slice(1)],
      await readAppliedMigrations(database.db),
    );

    expect(plan.drift).toHaveLength(1);
    expect(plan.drift[0]?.name).toBe(first.name);

    await expect(
      applyMigrations({ db: database.db, migrations: [tampered, ...migrations.slice(1)] }),
    ).rejects.toThrow(/changed after being applied/);
  });

  it("creates the identity tables and the migration ledger", async () => {
    const result = await database.db.query<{ table_name: string }>(
      `select table_name
         from information_schema.tables
        where table_schema = 'public'
        order by table_name asc`,
    );

    const tables = result.rows.map((row) => row.table_name);

    expect(tables).toEqual(
      expect.arrayContaining(["users", "profiles", "user_sessions", "schema_migrations"]),
    );
  });

  it("enables row-level security on every user-owned table", async () => {
    const result = await database.db.query<{ relname: string; relrowsecurity: boolean }>(
      `select c.relname, c.relrowsecurity
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname in ('users', 'profiles', 'user_sessions')`,
    );

    expect(result.rows).toHaveLength(3);

    for (const row of result.rows) {
      expect(row.relrowsecurity, `RLS is not enabled on public.${row.relname}`).toBe(true);
    }
  });

  it("gives the runtime role no way around the policies", async () => {
    const role = await database.db.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      `select rolname, rolcanlogin, rolsuper, rolbypassrls
         from pg_roles
        where rolname = 'rowan_app'`,
    );

    expect(role.rows).toHaveLength(1);
    expect(role.rows[0]).toMatchObject({
      rolcanlogin: false,
      rolsuper: false,
      rolbypassrls: false,
    });
  });

  it("keeps the runtime role out of table ownership", async () => {
    const owned = await database.db.query<{ count: string }>(
      `select count(*)::text as count
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
         join pg_roles r on r.oid = c.relowner
        where n.nspname = 'public'
          and c.relkind = 'r'
          and r.rolname = 'rowan_app'`,
    );

    expect(owned.rows[0]?.count).toBe("0");
  });

  it("defines policies for every verb the application uses on owned tables", async () => {
    const expected: [string, string[]][] = [
      ["users", ["SELECT", "INSERT", "UPDATE"]],
      ["profiles", ["SELECT", "INSERT", "UPDATE", "DELETE"]],
      ["user_sessions", ["SELECT", "INSERT", "UPDATE", "DELETE"]],
    ];

    for (const [table, verbs] of expected) {
      const policies = await database.db.query<{ cmd: string }>(
        `select cmd from pg_policies where schemaname = 'public' and tablename = $1`,
        [table],
      );

      const present = policies.rows.map((row) => row.cmd);

      expect(present.sort(), `policies on ${table}`).toEqual([...verbs].sort());
    }
  });

  it("scopes every policy to the runtime role rather than to PUBLIC", async () => {
    const policies = await database.db.query<{ tablename: string; roles: string[] }>(
      `select tablename, roles from pg_policies where schemaname = 'public' order by tablename asc`,
    );

    expect(policies.rows.length).toBeGreaterThan(0);

    for (const policy of policies.rows) {
      expect(policy.roles).toContain("rowan_app");
      expect(policy.roles).not.toContain("public");
      expect(policy.roles, `policy on ${policy.tablename} must not include {public}`).not.toContain(
        "{public}",
      );
    }
  });

  it("creates exactly one profile per account, enforced by the database", async () => {
    const userId = crypto.randomUUID();

    await database.db.query("insert into public.users (id, email) values ($1, $2)", [
      userId,
      `profile-trigger-${userId}@example.com`,
    ]);

    const profiles = await database.db.query<{ count: string }>(
      "select count(*)::text as count from public.profiles where user_id = $1",
      [userId],
    );

    expect(profiles.rows[0]?.count).toBe("1");

    await database.db.query("delete from public.users where id = $1", [userId]);
  });

  it("maintains updated_at without application involvement", async () => {
    const userId = crypto.randomUUID();

    await database.db.query("insert into public.users (id, email) values ($1, $2)", [
      userId,
      `updated-at-${userId}@example.com`,
    ]);

    const before = await database.db.query<{ updated_at: Date }>(
      "select updated_at from public.users where id = $1",
      [userId],
    );

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10));

    await database.db.query("update public.users set last_seen_at = now() where id = $1", [userId]);

    const after = await database.db.query<{ updated_at: Date }>(
      "select updated_at from public.users where id = $1",
      [userId],
    );

    expect(new Date(after.rows[0]?.updated_at ?? 0).getTime()).toBeGreaterThan(
      new Date(before.rows[0]?.updated_at ?? 0).getTime(),
    );

    await database.db.query("delete from public.users where id = $1", [userId]);
  });

  it("refuses to un-revoke a session", async () => {
    const userId = crypto.randomUUID();

    await database.db.query("insert into public.users (id, email) values ($1, $2)", [
      userId,
      `revocation-${userId}@example.com`,
    ]);

    const sessionId = crypto.randomUUID();
    await database.db.query(
      "insert into public.user_sessions (session_id, user_id, revoked_at) values ($1, $2, now())",
      [sessionId, userId],
    );

    await expect(
      database.db.query("update public.user_sessions set revoked_at = null where session_id = $1", [
        sessionId,
      ]),
    ).rejects.toThrow();

    await database.db.query("delete from public.users where id = $1", [userId]);
  });
});
