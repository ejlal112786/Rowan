import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";

/**
 * Transaction scoping.
 *
 * `withUserContext` is the boundary that makes row-level security effective, so what it
 * sends matters as much as what it returns. These tests drive it with a recording fake
 * connection and assert the exact statement sequence:
 *
 *   begin → set local role rowan_app → set_config('app.user_id', …) → … → commit
 *
 * and that a failure path rolls back, releases the connection, and surfaces a classified
 * error rather than an empty result.
 */
const recorder = vi.hoisted(() => ({
  statements: [] as { text: string; params: unknown[] }[],
  released: 0,
  failOn: null as string | null,
}));

vi.mock("@/lib/db/client", () => ({
  getPool: () => ({
    connect: async () => ({
      query: async (text: string, params?: unknown[]) => {
        recorder.statements.push({ text: text.trim().toLowerCase(), params: params ?? [] });

        if (recorder.failOn !== null && text.trim().toLowerCase().startsWith(recorder.failOn)) {
          throw Object.assign(new Error("permission denied for table profiles"), { code: "42501" });
        }

        return { rows: [], rowCount: 0 };
      },
      release: () => {
        recorder.released += 1;
      },
    }),
  }),
}));

const { RUNTIME_ROLE, withSystemContext, withUserContext } = await import("@/lib/db/query");

const USER_ID = "2f1c9a5e-3d4b-4c6f-9a1b-7e8d5c4b3a21";

beforeEach(() => {
  recorder.statements = [];
  recorder.released = 0;
  recorder.failOn = null;
});

describe("withUserContext", () => {
  it("narrows the transaction to the runtime role and the authenticated owner", async () => {
    await withUserContext(USER_ID, async (context) => {
      await context.query("select 1 from public.profiles where user_id = $1", [USER_ID]);
    });

    const texts = recorder.statements.map((statement) => statement.text);

    expect(texts[0]).toBe("begin");
    expect(texts[1]).toBe(`set local role ${RUNTIME_ROLE}`);
    expect(texts[2]).toBe("select set_config('app.user_id', $1, true)");
    expect(texts.at(-1)).toBe("commit");
  });

  it("passes the owner id as a parameter, never as interpolated SQL", async () => {
    await withUserContext(USER_ID, async () => {});

    const setConfig = recorder.statements.find((statement) =>
      statement.text.startsWith("select set_config"),
    );

    expect(setConfig?.params).toEqual([USER_ID]);
    expect(setConfig?.text).not.toContain(USER_ID);
  });

  it("refuses an owner id that is not a UUID before touching the connection", async () => {
    await expect(withUserContext("not-a-uuid", async () => {})).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });

    expect(recorder.statements).toEqual([]);
    expect(recorder.released).toBe(0);
  });

  it("parameterises the caller's query too", async () => {
    await withUserContext(USER_ID, async (context) => {
      await context.query("update public.profiles set display_name = $2 where user_id = $1", [
        USER_ID,
        "Person",
      ]);
    });

    const update = recorder.statements.find((statement) => statement.text.startsWith("update"));

    expect(update?.params).toEqual([USER_ID, "Person"]);
  });

  it("rolls back, releases the connection, and classifies failures", async () => {
    recorder.failOn = "select";

    await expect(
      withUserContext(USER_ID, async (context) => {
        await context.query("select * from public.profiles");
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const texts = recorder.statements.map((statement) => statement.text);

    expect(texts).toContain("rollback");
    expect(texts).not.toContain("commit");
    expect(recorder.released).toBe(1);
  });

  it("exposes the owner to the operation and a one-row helper", async () => {
    await withUserContext(USER_ID, async (context) => {
      expect(context.userId).toBe(USER_ID);
      await expect(context.queryOne("select 1")).resolves.toBeNull();
      await expect(context.mutate("update public.profiles set bio = $1")).resolves.toEqual({
        rowCount: 0,
      });
    });
  });
});

describe("withSystemContext", () => {
  it("does not switch role and does not set an owner", async () => {
    await withSystemContext(async (context) => {
      expect(context.userId).toBeNull();
      await context.query("delete from public.users where id = $1", [USER_ID]);
    });

    const texts = recorder.statements.map((statement) => statement.text);

    expect(texts).toEqual(["begin", "delete from public.users where id = $1", "commit"]);
    expect(texts.some((text) => text.includes("set local role"))).toBe(false);
    expect(texts.some((text) => text.includes("app.user_id"))).toBe(false);
  });

  it("still rolls back on failure", async () => {
    recorder.failOn = "delete";

    await expect(
      withSystemContext(async (context) => {
        await context.query("delete from public.users where id = $1", [USER_ID]);
      }),
    ).rejects.toThrowError(AppError);

    expect(recorder.statements.map((statement) => statement.text)).toContain("rollback");
  });
});

describe("runtime role constant", () => {
  it("matches the role created by the ownership migration", async () => {
    const migrations = await import("@/lib/db/migrations");
    const files = await migrations.loadMigrationsFromDirectory(
      new URL("../../supabase/migrations", import.meta.url).pathname,
    );

    const ownership = files.find((file) => file.name.includes("ownership"))?.sql ?? "";

    expect(RUNTIME_ROLE).toBe("rowan_app");
    // The migration creates the role with exactly this name, without login and without the
    // ability to bypass the policies.
    expect(ownership).toContain(`'${RUNTIME_ROLE}'`);
    expect(ownership.toLowerCase()).toContain("nologin");
    expect(ownership.toLowerCase()).toContain("nobypassrls");
    expect(ownership.toLowerCase()).toContain("enable row level security");
    expect(ownership.toLowerCase()).toContain("create policy");
    // And every policy is scoped to that role, never to PUBLIC.
    expect(ownership).toContain("to rowan_app");
  });
});
