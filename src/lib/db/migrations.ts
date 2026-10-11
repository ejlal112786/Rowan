import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Queryable } from "@/lib/db/types";
import { AppError } from "@/lib/errors";

/**
 * Versioned SQL migration runner.
 *
 * Properties this module guarantees:
 *
 * - **Deterministic order.** Migrations are named `<utc timestamp>_<description>.sql`
 *   and applied in ascending name order. The name is the version.
 * - **Applied once, recorded.** Every applied migration is recorded in
 *   `public.schema_migrations` with a checksum of its contents.
 * - **Tamper-evident.** Re-running with a modified migration file is a hard error, not
 *   a silent re-apply: the file changed after it was applied, and the database may no
 *   longer match the repository.
 * - **Atomic.** Each migration runs inside its own transaction together with its
 *   bookkeeping row: a failing migration leaves the database untouched.
 * - **Engine-agnostic.** All statements go through a `Queryable`, so the same runner is
 *   used by the CLI, by CI, and by the integration tests against a real PostgreSQL.
 */

/** `<14-digit UTC timestamp>_<lower_snake_case>.sql` */
export const MIGRATION_FILENAME_PATTERN = /^(\d{14})_[a-z0-9_]+\.sql$/;

export type MigrationFile = {
  name: string;
  sql: string;
  /** SHA-256 of the normalised SQL, used to detect edits after application. */
  checksum: string;
};

export type AppliedMigration = {
  name: string;
  checksum: string;
};

export type MigrationPlan = {
  /** Migrations to apply, in order. */
  pending: MigrationFile[];
  /** Migrations already recorded with a matching checksum. */
  applied: string[];
  /** Applied migrations whose file contents no longer match the recorded checksum. */
  drift: { name: string; appliedChecksum: string; fileChecksum: string }[];
  /** Recorded migrations with no corresponding file in the repository. */
  missingFiles: string[];
  /** Pending migrations older than the newest applied migration. */
  outOfOrder: MigrationFile[];
};

export type MigrationLog = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export type AppliedMigrationReport = {
  name: string;
  durationMs: number;
};

export type MigrationReport = {
  applied: AppliedMigrationReport[];
  skipped: string[];
};

/**
 * Checksum of a migration's content.
 *
 * Line endings are normalised so a checkout with `core.autocrlf` produces the same
 * checksum as the repository copy, and trailing whitespace is trimmed for the same
 * reason.
 */
export function checksumSql(sql: string): string {
  const normalised = sql
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trimEnd();

  return createHash("sha256").update(normalised, "utf8").digest("hex");
}

export function createMigrationFile(name: string, sql: string): MigrationFile {
  if (!MIGRATION_FILENAME_PATTERN.test(name)) {
    throw new AppError(`Migration file name is invalid: ${name}`, {
      code: "VALIDATION_FAILED",
      context: { expected: "<utc timestamp>_<description>.sql" },
    });
  }

  return { name, sql, checksum: checksumSql(sql) };
}

/** Sort by name, which is chronological because names begin with a UTC timestamp. */
export function sortMigrations(migrations: readonly MigrationFile[]): MigrationFile[] {
  return [...migrations].sort((left, right) => left.name.localeCompare(right.name));
}

/** Compare repository migrations with what the database has recorded. */
export function planMigrations(
  migrations: readonly MigrationFile[],
  applied: readonly AppliedMigration[],
): MigrationPlan {
  const sorted = sortMigrations(migrations);

  const duplicate = sorted.find((migration, index) => sorted[index - 1]?.name === migration.name);
  if (duplicate) {
    throw new AppError(`Duplicate migration name: ${duplicate.name}`, {
      code: "VALIDATION_FAILED",
    });
  }

  const appliedByChecksum = new Map(applied.map((row) => [row.name, row.checksum]));
  const repositoryNames = new Set(sorted.map((migration) => migration.name));

  const pending = sorted.filter((migration) => !appliedByChecksum.has(migration.name));

  const drift = sorted
    .filter((migration) => {
      const recorded = appliedByChecksum.get(migration.name);
      return recorded !== undefined && recorded !== migration.checksum;
    })
    .map((migration) => ({
      name: migration.name,
      appliedChecksum: appliedByChecksum.get(migration.name) ?? "",
      fileChecksum: migration.checksum,
    }));

  const missingFiles = applied
    .map((row) => row.name)
    .filter((name) => !repositoryNames.has(name))
    .sort((left, right) => left.localeCompare(right));

  const newestApplied = [...appliedByChecksum.keys()]
    .sort((left, right) => left.localeCompare(right))
    .at(-1);

  const outOfOrder =
    newestApplied === undefined
      ? []
      : pending.filter((migration) => migration.name.localeCompare(newestApplied) < 0);

  return {
    pending,
    applied: [...appliedByChecksum.keys()].sort((left, right) => left.localeCompare(right)),
    drift,
    missingFiles,
    outOfOrder,
  };
}

const SCHEMA_MIGRATIONS_TABLE = "public.schema_migrations";

const CREATE_SCHEMA_MIGRATIONS = `
  create table if not exists ${SCHEMA_MIGRATIONS_TABLE} (
    name text primary key,
    checksum text not null,
    applied_at timestamptz not null default now(),
    duration_ms integer not null default 0
  )
`;

/** Read the applied-migration ledger, creating it when it does not exist yet. */
export async function readAppliedMigrations(db: Queryable): Promise<AppliedMigration[]> {
  await db.query(CREATE_SCHEMA_MIGRATIONS);

  const result = await db.query<{ name: string; checksum: string }>(
    `select name, checksum from ${SCHEMA_MIGRATIONS_TABLE} order by name asc`,
  );

  return result.rows.map((row) => ({ name: row.name, checksum: row.checksum }));
}

/**
 * Apply every pending migration, in order.
 *
 * Refuses to run when the ledger shows drift (an applied migration whose file changed)
 * or a recorded migration that no longer exists in the repository — both mean the
 * database and the repository disagree about history, which must be resolved by a
 * human rather than by guessing.
 */
export async function applyMigrations(options: {
  db: Queryable;
  migrations: readonly MigrationFile[];
  log?: MigrationLog;
}): Promise<MigrationReport> {
  const { db, migrations } = options;
  const log: MigrationLog = options.log ?? { info: () => {}, warn: () => {} };

  const applied = await readAppliedMigrations(db);
  const plan = planMigrations(migrations, applied);

  if (plan.drift.length > 0) {
    const names = plan.drift.map((entry) => entry.name).join(", ");
    throw new AppError(
      `Migration history mismatch: ${names} changed after being applied. Create a new migration instead of editing an applied one.`,
      { code: "CONFLICT", context: { drift: plan.drift } },
    );
  }

  if (plan.missingFiles.length > 0) {
    log.warn(
      `Recorded migrations with no file in the repository: ${plan.missingFiles.join(", ")} — the database is ahead of this checkout.`,
    );
  }

  for (const migration of plan.outOfOrder) {
    log.warn(`Applying ${migration.name} out of order: it predates an already-applied migration.`);
  }

  const report: MigrationReport = { applied: [], skipped: plan.applied };

  for (const migration of plan.pending) {
    const startedAt = Date.now();

    await db.query("begin");

    try {
      await db.query(migration.sql);

      const durationMs = Date.now() - startedAt;

      await db.query(
        `insert into ${SCHEMA_MIGRATIONS_TABLE} (name, checksum, duration_ms) values ($1, $2, $3)`,
        [migration.name, migration.checksum, durationMs],
      );

      await db.query("commit");

      report.applied.push({ name: migration.name, durationMs });
      log.info(`applied ${migration.name} (${durationMs}ms)`);
    } catch (error) {
      try {
        await db.query("rollback");
      } catch {
        // The connection is unusable; the original failure is the one to report.
      }

      if (error instanceof AppError) {
        throw new AppError(`Migration ${migration.name} failed: ${error.message}`, {
          code: error.code,
          context: { ...error.context, migration: migration.name },
          cause: error,
        });
      }

      throw error;
    }
  }

  return report;
}

/** Read every migration file in a directory, sorted, with checksums. */
export async function loadMigrationsFromDirectory(directory: string): Promise<MigrationFile[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: MigrationFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".sql")) {
      continue;
    }

    const sql = await readFile(join(directory, entry.name), "utf8");
    files.push(createMigrationFile(entry.name, sql));
  }

  if (files.length === 0) {
    throw new AppError(`No migration files found in ${directory}`, { code: "INTERNAL" });
  }

  return sortMigrations(files);
}
