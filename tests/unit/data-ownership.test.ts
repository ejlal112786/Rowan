import { describe, expect, it } from "vitest";

import type { TransactionContext } from "@/lib/db/query";
import { assertOwnedRows, requireOwner } from "@/lib/data/ownership";
import { AppError } from "@/lib/errors";

/**
 * Ownership helpers.
 *
 * `requireOwner` is what stops a user-scoped query from ever running unowned — under the
 * row-level security policies an unowned query matches nothing, which is safe but silent,
 * and silence is exactly what hides bugs. `assertOwnedRows` turns a hypothetical regression
 * (a dropped policy, a connection running as the wrong role) into an error instead of a
 * quiet leak.
 */
const OWNER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function context(userId: string | null): TransactionContext {
  return {
    userId,
    query: async () => ({ rows: [], rowCount: null }),
    queryOne: async () => null,
    mutate: async () => ({ rowCount: 0 }),
  };
}

describe("requireOwner", () => {
  it("returns the authenticated owner", () => {
    expect(requireOwner(context(OWNER))).toBe(OWNER);
  });

  it("refuses to run unowned", () => {
    expect(() => requireOwner(context(null))).toThrowError(AppError);

    try {
      requireOwner(context(null));
      expect.unreachable("requireOwner should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("UNAUTHENTICATED");
    }
  });
});

describe("assertOwnedRows", () => {
  it("passes rows owned by the authenticated user", () => {
    expect(() =>
      assertOwnedRows([{ user_id: OWNER, display_name: "Person" }], OWNER),
    ).not.toThrow();
  });

  it("rejects a row owned by another account", () => {
    try {
      assertOwnedRows([{ user_id: OWNER }, { user_id: OTHER }], OWNER);
      expect.unreachable("assertOwnedRows should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("FORBIDDEN");
      expect((error as AppError).message).not.toContain(OTHER);
    }
  });

  it("treats a missing owner column as a violation rather than as a pass", () => {
    expect(() => assertOwnedRows([{ display_name: "Person" }], OWNER)).toThrowError(AppError);
  });

  it("accepts an explicit key for tables keyed by id", () => {
    expect(() => assertOwnedRows([{ id: OWNER }], OWNER, "id")).not.toThrow();
    expect(() => assertOwnedRows([{ id: OTHER }], OWNER, "id")).toThrowError(AppError);
  });

  it("passes an empty result set", () => {
    expect(() => assertOwnedRows([], OWNER)).not.toThrow();
  });
});
