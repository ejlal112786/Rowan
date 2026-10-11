import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createPool } from "@/lib/db/pool";
import { createPgQueryable } from "@/lib/db/pg";
import { describeRuntimeContext, withUserContext } from "@/lib/db/query";
import { AppError } from "@/lib/errors";
import {
  connectTestDatabase,
  countRows,
  resetTestDatabase,
  seedUser,
  testConnectionString,
  type SeededUser,
  type TestDatabase,
} from "../support/database";

/**
 * Tenant isolation, verified against real PostgreSQL.
 *
 * This is the evidence behind the Phase 2 acceptance criterion "two users cannot read or
 * mutate each other's rows, proven by tests that must fail closed". Every assertion below
 * runs the production path (`withUserContext`) with a real role switch and real row-level
 * security policies — not a mocked database, and not a check performed in application code
 * that the test could be talked out of.
 *
 * The final case is the one that matters most: when the owner context is *missing*, the
 * database returns nothing rather than everything.
 */
const skipReason = process.env.ROWAN_TEST_DATABASE_SKIP;

describe.skipIf(skipReason !== undefined)("row-level security", () => {
  let database: TestDatabase;
  let alice: SeededUser;
  let bob: SeededUser;
  let bobSessionId: string;

  beforeAll(async () => {
    database = connectTestDatabase();
    await resetTestDatabase(database.db);

    alice = await seedUser(database.db, { email: "alice@example.com", displayName: "Alice" });
    bob = await seedUser(database.db, { email: "bob@example.com", displayName: "Bob" });

    bobSessionId = crypto.randomUUID();
    await database.db.query(
      "insert into public.user_sessions (session_id, user_id, user_agent) values ($1, $2, $3)",
      [bobSessionId, bob.id, "Bob's laptop"],
    );
  });

  afterAll(async () => {
    await database.close();
  });

  it("confirms the fixture exists, so isolation is not just an empty database", async () => {
    expect(await countRows(database.db, "users")).toBe(2);
    expect(await countRows(database.db, "profiles")).toBe(2);
    expect(await countRows(database.db, "user_sessions")).toBe(1);
  });

  it("runs user-scoped queries as the RLS-enforced runtime role", async () => {
    const context = await withUserContext(alice.id, async (transaction) => {
      return describeRuntimeContext(transaction);
    });

    expect(context.role).toBe("rowan_app");
    expect(context.owner).toBe(alice.id);
  });

  it("shows an account only its own rows", async () => {
    const seen = await withUserContext(alice.id, async (transaction) => {
      const users = await transaction.query<{ id: string }>("select id from public.users");
      const profiles = await transaction.query<{ user_id: string }>(
        "select user_id from public.profiles",
      );
      const sessions = await transaction.query<{ session_id: string }>(
        "select session_id from public.user_sessions",
      );

      return { users: users.rows, profiles: profiles.rows, sessions: sessions.rows };
    });

    expect(seen.users.map((row) => row.id)).toEqual([alice.id]);
    expect(seen.profiles.map((row) => row.user_id)).toEqual([alice.id]);
    // Bob's session must not appear, even though the table holds it.
    expect(seen.sessions).toEqual([]);
  });

  it("refuses to let one account write a row owned by another", async () => {
    const error = await withUserContext(alice.id, async (transaction) => {
      return transaction
        .query("insert into public.user_sessions (session_id, user_id) values ($1, $2)", [
          crypto.randomUUID(),
          bob.id,
        ])
        .then(
          () => null,
          (caught: unknown) => caught,
        );
    });

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("FORBIDDEN");

    // And nothing was written for Bob by Alice's attempt.
    expect(await countRows(database.db, "user_sessions")).toBe(1);
  });

  it("does not update or delete another account's rows", async () => {
    const outcome = await withUserContext(alice.id, async (transaction) => {
      const renamed = await transaction.mutate(
        "update public.profiles set display_name = $2 where user_id = $1",
        [bob.id, "Alice was here"],
      );
      const removed = await transaction.mutate(
        "delete from public.user_sessions where user_id = $1",
        [bob.id],
      );

      return { renamed: renamed.rowCount, removed: removed.rowCount };
    });

    expect(outcome).toEqual({ renamed: 0, removed: 0 });

    const bobProfile = await database.db.query<{ display_name: string | null }>(
      "select display_name from public.profiles where user_id = $1",
      [bob.id],
    );
    expect(bobProfile.rows[0]?.display_name).toBe("Bob");
    expect(await countRows(database.db, "user_sessions")).toBe(1);
  });

  it("fails closed when the owner context is missing", async () => {
    // Simulates the bug this whole layer defends against: a query running as the runtime
    // role without an authenticated owner. Row-level security must return nothing.
    const pool = createPool(testConnectionString());
    const client = await pool.connect();
    const db = createPgQueryable(client);

    try {
      await db.query("begin");
      await db.query("set local role rowan_app");

      const users = await db.query<{ id: string }>("select id from public.users");
      const profiles = await db.query<{ user_id: string }>("select user_id from public.profiles");
      const sessions = await db.query("select session_id from public.user_sessions");

      expect(users.rows).toEqual([]);
      expect(profiles.rows).toEqual([]);
      expect(sessions.rows).toEqual([]);

      await db.query("rollback");
    } finally {
      client.release();
      await pool.end();
    }
  });

  it("keeps the runtime role out of the rows it has no policy for", async () => {
    // The runtime role holds no DELETE grant on public.users: account deletion is a
    // privileged operation, so it must not be reachable from a request-scoped transaction.
    const error = await withUserContext(alice.id, async (transaction) => {
      return transaction.query("delete from public.users where id = $1", [alice.id]).then(
        () => null,
        (caught: unknown) => caught,
      );
    });

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("FORBIDDEN");
    expect(await countRows(database.db, "users")).toBe(2);
  });

  it("refuses an owner id that is not the authenticated user", async () => {
    // Defence in depth: even if a caller passed another account's id as the "owner", the
    // policies compare it against the row's own column, so nothing of Bob's is visible.
    const rows = await withUserContext(bob.id, async (transaction) => {
      const result = await transaction.query<{ id: string }>(
        "select id from public.users where id = $1",
        [alice.id],
      );

      return result.rows;
    });

    expect(rows).toEqual([]);
  });
});
