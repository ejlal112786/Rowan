import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import EmbeddedPostgres from "embedded-postgres";

/**
 * Ephemeral PostgreSQL for integration tests.
 *
 * Two modes, in priority order:
 *
 * 1. `TEST_DATABASE_URL` — use a database someone else runs (CI service container, a
 *    developer's local PostgreSQL). Nothing is created or destroyed.
 * 2. Otherwise — start a throwaway PostgreSQL from the bundled binaries
 *    (`embedded-postgres`) on a free port inside the system temp directory, create the
 *    test database, and delete everything on teardown.
 *
 * Both modes run real PostgreSQL, so the tests exercise real row-level security, real
 * roles, and the same driver (`pg`) the application uses. A test double could not.
 */

export type PostgresServer = {
  connectionString: string;
  /** True when an external database was supplied through `TEST_DATABASE_URL`. */
  external: boolean;
  stop: () => Promise<void>;
};

const DEFAULT_DATABASE = "rowan_test";
const STARTUP_TIMEOUT_MS = 60_000;

async function findFreePort(): Promise<number> {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();

    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;

      server.close(() => {
        if (port === 0) {
          rejectPort(new Error("could not allocate a port for the test database"));
          return;
        }

        resolvePort(port);
      });
    });
  });
}

function withTimeout<Value>(promise: Promise<Value>, label: string): Promise<Value> {
  return new Promise<Value>((resolveValue, rejectValue) => {
    const timer = setTimeout(() => {
      rejectValue(new Error(`timed out after ${STARTUP_TIMEOUT_MS}ms while ${label}`));
    }, STARTUP_TIMEOUT_MS);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolveValue(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        rejectValue(error);
      },
    );
  });
}

/** Start (or adopt) a PostgreSQL instance for the integration suite. */
export async function startPostgres(): Promise<PostgresServer> {
  const externalUrl = process.env.TEST_DATABASE_URL;

  if (externalUrl !== undefined && externalUrl.trim() !== "") {
    return {
      connectionString: externalUrl,
      external: true,
      stop: async () => {},
    };
  }

  const port = await findFreePort();
  const dataDirectory = await mkdtemp(join(tmpdir(), "rowan-test-db-"));
  const user = "postgres";
  const password = "postgres";

  const server = new EmbeddedPostgres({
    databaseDir: dataDirectory,
    port,
    user,
    password,
    persistent: false,
  });

  await withTimeout(server.initialise(), "initialising the test database cluster");
  await withTimeout(server.start(), "starting the test database");
  await withTimeout(server.createDatabase(DEFAULT_DATABASE), "creating the test database");

  const connectionString = `postgresql://${user}:${password}@127.0.0.1:${port}/${DEFAULT_DATABASE}`;

  return {
    connectionString,
    external: false,
    stop: async () => {
      await server.stop().catch(() => {
        // A cluster that already exited needs no further cleanup.
      });
      await rm(dataDirectory, { recursive: true, force: true }).catch(() => {});
    },
  };
}
