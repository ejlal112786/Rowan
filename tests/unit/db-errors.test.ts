import { describe, expect, it } from "vitest";

import { toDatabaseAppError } from "@/lib/db/errors";
import { AppError } from "@/lib/errors";

/**
 * Database failure classification.
 *
 * The rule that matters: a row-level-security rejection must never be mistakable for "no
 * rows matched". A query that did not prove ownership fails loudly (`FORBIDDEN`), while an
 * empty result stays an empty result. Anything unrecognised becomes `INTERNAL`, so an
 * unexpected driver failure can never be silently treated as success.
 */
function driverError(code: string, message: string, extra: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(message), { code, severity: "ERROR", ...extra });
}

describe("toDatabaseAppError", () => {
  it("maps a row-level-security policy violation to FORBIDDEN", () => {
    const error = toDatabaseAppError(
      driverError("42501", 'new row violates row-level security policy for table "profiles"'),
    );

    expect(error.code).toBe("FORBIDDEN");
    expect(error.httpStatus).toBe(403);
  });

  it("maps a raw insufficient-privilege failure to FORBIDDEN", () => {
    expect(toDatabaseAppError(driverError("42501", "permission denied for table users")).code).toBe(
      "FORBIDDEN",
    );
  });

  it("maps a unique violation to CONFLICT", () => {
    const error = toDatabaseAppError(
      driverError("23505", 'duplicate key value violates unique constraint "users_email_key"', {
        constraint: "users_email_key",
      }),
    );

    expect(error.code).toBe("CONFLICT");
    expect(error.httpStatus).toBe(409);
  });

  it("maps a foreign-key violation to VALIDATION_FAILED", () => {
    expect(
      toDatabaseAppError(driverError("23503", "insert or update violates foreign key")).code,
    ).toBe("VALIDATION_FAILED");
  });

  it("maps constraint failures to VALIDATION_FAILED", () => {
    expect(toDatabaseAppError(driverError("23514", "check constraint violated")).code).toBe(
      "VALIDATION_FAILED",
    );
    expect(
      toDatabaseAppError(driverError("22P02", "invalid input syntax for type uuid")).code,
    ).toBe("VALIDATION_FAILED");
  });

  it("maps a serialization failure to a retryable CONFLICT", () => {
    expect(toDatabaseAppError(driverError("40001", "could not serialize access")).code).toBe(
      "CONFLICT",
    );
  });

  it("maps a missing table to INTERNAL with a schema hint", () => {
    const error = toDatabaseAppError(
      driverError("42P01", 'relation "public.users" does not exist'),
    );

    expect(error.code).toBe("INTERNAL");
    expect(error.message).toMatch(/schema is not ready/i);
  });

  it("maps a statement timeout to INTERNAL", () => {
    expect(toDatabaseAppError(driverError("57014", "canceling statement")).code).toBe("INTERNAL");
  });

  it("treats an unknown failure as INTERNAL rather than as an empty result", () => {
    const error = toDatabaseAppError(new Error("something nobody has seen before"));

    expect(error.code).toBe("INTERNAL");
    expect(error.message).toBe("The database operation failed.");
  });

  it("never puts the driver message in the user-facing message", () => {
    const secret = 'password authentication failed for user "postgres"';
    const error = toDatabaseAppError(driverError("28P01", secret));

    expect(error.message).not.toContain(secret);
    expect(error.message).not.toContain("postgres");
  });

  it("keeps driver details in the server-side context", () => {
    const error = toDatabaseAppError(
      driverError("23505", "duplicate key value violates unique constraint", {
        constraint: "user_sessions_pkey",
      }),
    );

    expect(error.context).toMatchObject({ sqlState: "23505", constraint: "user_sessions_pkey" });
  });

  it("passes an existing AppError through unchanged", () => {
    const original = new AppError("You must be signed in to do that.", { code: "UNAUTHENTICATED" });

    expect(toDatabaseAppError(original)).toBe(original);
  });

  it("handles non-object throws", () => {
    expect(toDatabaseAppError("just a string").code).toBe("INTERNAL");
    expect(toDatabaseAppError(undefined).code).toBe("INTERNAL");
  });
});
