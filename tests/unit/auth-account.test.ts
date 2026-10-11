import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Account-deletion ordering.
 *
 * The order is the security property. Revoking sessions first means access ends immediately;
 * deleting the provider user before local rows means Rowan can never end up with rows whose
 * owner can still authenticate — the failure mode that would leave an account able to sign
 * in while its data was already gone. If the provider step fails, nothing local is deleted.
 */
const events = vi.hoisted(() => ({
  order: [] as string[],
  providerFails: false,
  localDeleteFails: false,
  providerCode: undefined as string | undefined,
}));

vi.mock("@/lib/db/query", () => ({
  withUserContext: async (userId: string, operation: (context: unknown) => Promise<unknown>) => {
    events.order.push("revoke-sessions");
    void userId;
    return operation({ userId });
  },
}));

vi.mock("@/lib/data/sessions", () => ({
  revokeOtherSessions: async () => {
    events.order.push("revoke-rows");
    return { revoked: 1 };
  },
}));

vi.mock("@/lib/data/users", () => ({
  deleteAccountRecords: async () => {
    events.order.push("delete-rows");
    if (events.localDeleteFails) {
      throw new Error("connection lost");
    }
    return { deleted: true };
  },
}));

vi.mock("@/lib/auth/server-client", () => ({
  createSupabaseAdminClient: () => ({
    auth: {
      admin: {
        deleteUser: async () => {
          events.order.push("delete-provider-user");
          return events.providerFails
            ? {
                data: null,
                error: {
                  code: events.providerCode ?? "unexpected",
                  status: 500,
                  message: "upstream detail",
                },
              }
            : { data: { user: {} }, error: null };
        },
      },
    },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
}));

const { deleteAccount } = await import("@/lib/auth/account");

const USER = { id: "11111111-1111-4111-8111-111111111111", sessionId: "session-abcdef123456" };

beforeEach(() => {
  events.order = [];
  events.providerFails = false;
  events.localDeleteFails = false;
  events.providerCode = undefined;
});

describe("deleteAccount", () => {
  it("revokes sessions, deletes the provider user, then removes local rows", async () => {
    const result = await deleteAccount(USER);

    expect(result).toEqual({ deleted: true });
    expect(events.order).toEqual([
      "revoke-sessions",
      "revoke-rows",
      "delete-provider-user",
      "delete-rows",
    ]);
  });

  it("does not delete local rows when the provider refuses", async () => {
    events.providerFails = true;

    const result = await deleteAccount(USER);

    expect(result.deleted).toBe(false);
    expect(events.order).not.toContain("delete-rows");
    if (result.deleted) return;
    expect(result.message).not.toContain("upstream detail");
  });

  it("treats an already-deleted provider user as success, so a retry is safe", async () => {
    events.providerFails = true;
    events.providerCode = "user_not_found";

    const result = await deleteAccount(USER);

    expect(result).toEqual({ deleted: true });
    expect(events.order).toContain("delete-rows");
  });

  it("still reports success when local cleanup fails after the provider is gone", async () => {
    // Access is already impossible at this point; leaving the user stuck on an error screen
    // would be worse than reporting the deletion and logging the residue.
    events.localDeleteFails = true;

    const result = await deleteAccount(USER);

    expect(result).toEqual({ deleted: true });
    expect(events.order).toContain("delete-rows");
  });
});
