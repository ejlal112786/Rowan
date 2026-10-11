import { describe, expect, it } from "vitest";

import {
  checksumSql,
  createMigrationFile,
  loadMigrationsFromDirectory,
  planMigrations,
  sortMigrations,
  type MigrationFile,
} from "@/lib/db/migrations";
import { AppError } from "@/lib/errors";

/**
 * Migration planning.
 *
 * The properties under test are the ones that decide whether a deployment can trust its
 * database: files apply in a deterministic order, an applied migration that changed on disk
 * is *detected* rather than re-run, and a pending migration older than an applied one is
 * surfaced instead of being applied silently.
 */
const MIGRATIONS_DIRECTORY = new URL("../../supabase/migrations", import.meta.url).pathname;

function migration(name: string, sql = "select 1;"): MigrationFile {
  return createMigrationFile(name, sql);
}

/**
 * Remove `--` line comments so an assertion about executable SQL cannot be satisfied — or
 * broken — by documentation.
 */
function stripSqlComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

describe("createMigrationFile", () => {
  it("accepts the documented naming convention", () => {
    expect(() => migration("20261011120000_identity_schema.sql")).not.toThrow();
  });

  it("rejects names without a UTC timestamp prefix", () => {
    expect(() => migration("identity_schema.sql")).toThrowError(AppError);
    expect(() => migration("2026-10-11_identity.sql")).toThrowError(AppError);
  });

  it("rejects names that are not lower snake case", () => {
    expect(() => migration("20261011120000_Identity-Schema.sql")).toThrowError(AppError);
  });
});

describe("checksumSql", () => {
  it("is stable for identical content", () => {
    expect(checksumSql("select 1;")).toBe(checksumSql("select 1;"));
  });

  it("ignores line-ending and trailing-whitespace differences", () => {
    // A Windows checkout must not look like a modified migration.
    expect(checksumSql("select 1;\nselect 2;\n")).toBe(
      checksumSql("select 1;   \r\nselect 2;\r\n"),
    );
  });

  it("changes when the content changes", () => {
    expect(checksumSql("select 1;")).not.toBe(checksumSql("select 2;"));
  });
});

describe("sortMigrations", () => {
  it("orders by name, which is chronological", () => {
    const sorted = sortMigrations([
      migration("20261011120200_third.sql"),
      migration("20261011120000_first.sql"),
      migration("20261011120100_second.sql"),
    ]);

    expect(sorted.map((entry) => entry.name)).toEqual([
      "20261011120000_first.sql",
      "20261011120100_second.sql",
      "20261011120200_third.sql",
    ]);
  });
});

describe("planMigrations", () => {
  const first = migration("20261011120000_first.sql");
  const second = migration("20261011120100_second.sql");
  const third = migration("20261011120200_third.sql");

  it("plans everything when the database is empty", () => {
    const plan = planMigrations([first, second, third], []);

    expect(plan.pending.map((entry) => entry.name)).toEqual([first.name, second.name, third.name]);
    expect(plan.applied).toEqual([]);
    expect(plan.drift).toEqual([]);
  });

  it("plans nothing when everything is applied", () => {
    const plan = planMigrations(
      [first, second],
      [
        { name: first.name, checksum: first.checksum },
        { name: second.name, checksum: second.checksum },
      ],
    );

    expect(plan.pending).toEqual([]);
    expect(plan.applied).toEqual([first.name, second.name]);
  });

  it("plans only what is missing", () => {
    const plan = planMigrations(
      [first, second, third],
      [{ name: first.name, checksum: first.checksum }],
    );

    expect(plan.pending.map((entry) => entry.name)).toEqual([second.name, third.name]);
  });

  it("reports drift when an applied migration changed on disk", () => {
    const edited = migration(first.name, "select 1; -- edited");

    const plan = planMigrations(
      [edited, second],
      [
        { name: first.name, checksum: first.checksum },
        { name: second.name, checksum: second.checksum },
      ],
    );

    expect(plan.drift).toHaveLength(1);
    expect(plan.drift[0]).toMatchObject({
      name: first.name,
      appliedChecksum: first.checksum,
      fileChecksum: edited.checksum,
    });
  });

  it("reports recorded migrations that no longer exist in the repository", () => {
    const plan = planMigrations(
      [first],
      [
        { name: first.name, checksum: first.checksum },
        { name: "20260101000000_removed.sql", checksum: "abc" },
      ],
    );

    expect(plan.missingFiles).toEqual(["20260101000000_removed.sql"]);
  });

  it("flags a pending migration that predates an applied one", () => {
    const plan = planMigrations(
      [first, second],
      [{ name: second.name, checksum: second.checksum }],
    );

    expect(plan.outOfOrder.map((entry) => entry.name)).toEqual([first.name]);
  });

  it("refuses a duplicated migration name", () => {
    expect(() => planMigrations([first, first], [])).toThrowError(AppError);
  });
});

describe("repository migrations", () => {
  it("loads the committed migrations with valid names and non-empty SQL", async () => {
    const migrations = await loadMigrationsFromDirectory(MIGRATIONS_DIRECTORY);

    expect(migrations.length).toBeGreaterThan(0);

    for (const entry of migrations) {
      expect(entry.name).toMatch(/^\d{14}_[a-z0-9_]+\.sql$/);
      expect(entry.sql.trim().length).toBeGreaterThan(0);
      expect(entry.checksum).toHaveLength(64);
    }

    // The order the runner will use is chronological.
    expect(migrations.map((entry) => entry.name)).toEqual(
      [...migrations.map((entry) => entry.name)].sort(),
    );
  });

  it("keeps the identity schema provider-neutral and the Supabase step guarded", async () => {
    const migrations = await loadMigrationsFromDirectory(MIGRATIONS_DIRECTORY);
    const identity = stripSqlComments(migrations[0]?.sql ?? "");
    const supabase = stripSqlComments(migrations.at(-1)?.sql ?? "");

    // Executable statements in the base schema must not reference the provider's internal
    // schema, or the migration could not be applied to a plain PostgreSQL database (local
    // development, integration tests). Comments may *discuss* the provider; code may not
    // depend on it.
    expect(identity).not.toMatch(/auth\.users/i);
    expect(identity).toMatch(/create table public\.users/i);

    // The provider-specific step is conditional on that schema existing, and it must not be
    // able to fail a deployment.
    expect(supabase).toMatch(/auth\.users/i);
    expect(supabase).toMatch(/if not exists/i);
    expect(supabase).toMatch(/raise warning/i);
    expect(supabase).toMatch(/information_schema\.tables/i);
  });
});
