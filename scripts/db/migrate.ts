/**
 * Rowan database migration CLI.
 *
 *   pnpm db:migrate                     apply every pending migration
 *   pnpm db:migrate --status             show applied/pending state, change nothing
 *   pnpm db:migrate --dry-run            show what would be applied
 *   pnpm db:migrate --env-file .env.local  load DATABASE_URL from a file
 *
 * The connection string comes from `DATABASE_URL` (see `.env.example`). Migrations are
 * read from `supabase/migrations` in ascending name order and recorded in
 * `public.schema_migrations`, so repeated runs are safe and a modified history is
 * detected rather than silently re-applied.
 *
 * Run with `pnpm db:migrate`, which executes this file through `tsx`.
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Pool } from "pg";

import { createPool } from "@/lib/db/pool";
import {
  applyMigrations,
  checksumSql,
  loadMigrationsFromDirectory,
  planMigrations,
  readAppliedMigrations,
  type MigrationLog,
} from "@/lib/db/migrations";
import { createPgQueryable } from "@/lib/db/pg";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_MIGRATIONS_DIRECTORY = resolve(REPOSITORY_ROOT, "supabase", "migrations");

/** Serialises concurrent migration runs (deploys, CI, two terminals). */
const ADVISORY_LOCK_KEY = 4_152_633_411;

const HELP = `Rowan database migrations

Usage
  pnpm db:migrate [options]

Options
  --status               report state and exit (applies nothing)
  --dry-run              report what would be applied, then exit
  --dir <path>           migrations directory (default: supabase/migrations)
  --env-file <path>      load environment variables from a file first
  -h, --help             show this message

Environment
  DATABASE_URL           PostgreSQL connection string (required)
  DATABASE_MIGRATION_URL  optional override with elevated privileges
`;

type CliOptions = {
  status: boolean;
  dryRun: boolean;
  directory: string;
  envFile: string | undefined;
  help: boolean;
};

function parseArguments(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    status: false,
    dryRun: false,
    directory: DEFAULT_MIGRATIONS_DIRECTORY,
    envFile: undefined,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    switch (argument) {
      case "--status":
        options.status = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--dir": {
        const value = argv[index + 1];
        if (value === undefined) {
          throw new Error("--dir requires a path");
        }
        options.directory = resolve(process.cwd(), value);
        index += 1;
        break;
      }
      case "--env-file": {
        const value = argv[index + 1];
        if (value === undefined) {
          throw new Error("--env-file requires a path");
        }
        options.envFile = resolve(process.cwd(), value);
        index += 1;
        break;
      }
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${String(argument)}`);
    }
  }

  return options;
}

function loadEnvFileIfRequested(path: string | undefined): void {
  if (path === undefined) {
    return;
  }

  // Node 20.12+/22 loads a dotenv-style file without adding a dependency.
  process.loadEnvFile(path);
  console.log(`Loaded environment from ${path}`);
}

function consoleLog(): MigrationLog {
  return {
    info: (message) => console.log(`  ${message}`),
    warn: (message) => console.warn(`  ! ${message}`),
  };
}

async function main(): Promise<number> {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    console.log(HELP);
    return 0;
  }

  loadEnvFileIfRequested(options.envFile);

  const connectionString = process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString.trim() === "") {
    console.error(
      "DATABASE_URL is not set. Export it or pass --env-file .env.local. Migrations are never run against an implicit target.",
    );
    return 1;
  }

  const migrations = await loadMigrationsFromDirectory(options.directory);
  console.log(`Migrations directory: ${options.directory} (${migrations.length} files)`);
  for (const migration of migrations) {
    console.log(`  ${migration.name}  ${checksumSql(migration.sql).slice(0, 12)}`);
  }

  const pool: Pool = createPool(connectionString);
  const db = createPgQueryable(pool);
  const log = consoleLog();

  try {
    await db.query("select pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
  } catch {
    // Advisory locks are unavailable only on exotic targets; the runner still works,
    // it just cannot serialise two simultaneous runs.
    log.warn("could not take the migration advisory lock; ensure only one migration runs");
  }

  try {
    if (options.status || options.dryRun) {
      const applied = await readAppliedMigrations(db);
      const plan = planMigrations(migrations, applied);

      console.log(`\nApplied: ${plan.applied.length}`);
      for (const name of plan.applied) {
        console.log(`  ✓ ${name}`);
      }

      console.log(`\nPending: ${plan.pending.length}`);
      for (const migration of plan.pending) {
        const ordering = plan.outOfOrder.some((entry) => entry.name === migration.name)
          ? "  (out of order — predates an applied migration)"
          : "";
        console.log(`  · ${migration.name}${ordering}`);
      }

      if (plan.drift.length > 0) {
        console.error("\nDrift detected — these applied migrations changed on disk:");
        for (const entry of plan.drift) {
          console.error(`  ✗ ${entry.name}`);
        }
      }

      if (plan.missingFiles.length > 0) {
        console.warn("\nRecorded in the database but absent from this checkout:");
        for (const name of plan.missingFiles) {
          console.warn(`  ? ${name}`);
        }
      }

      const failed = plan.drift.length > 0;
      console.log(`\n${failed ? "State: inconsistent" : "State: consistent"}`);

      return failed ? 1 : 0;
    }

    const report = await applyMigrations({ db, migrations, log });

    console.log(
      `\nApplied ${report.applied.length} migration(s); ${report.skipped.length} already up to date.`,
    );

    return 0;
  } finally {
    try {
      await db.query("select pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]);
    } catch {
      // Releasing a lock that was never taken is not an error worth failing on.
    }

    await pool.end();
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error("\nMigration failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
