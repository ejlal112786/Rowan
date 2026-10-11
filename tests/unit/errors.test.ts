import { describe, expect, it } from "vitest";

import {
  AppError,
  GENERIC_ERROR_MESSAGE,
  isAppError,
  toAppError,
  toPublicError,
} from "@/lib/errors";

describe("AppError", () => {
  it("defaults to an internal error with status 500", () => {
    const error = new AppError("Boom");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.code).toBe("INTERNAL");
    expect(error.httpStatus).toBe(500);
    expect(error.message).toBe("Boom");
  });

  it("maps known error codes to HTTP statuses", () => {
    expect(new AppError("Bad input", { code: "VALIDATION_FAILED" }).httpStatus).toBe(400);
    expect(new AppError("No session", { code: "UNAUTHENTICATED" }).httpStatus).toBe(401);
    expect(new AppError("Slow down", { code: "RATE_LIMITED" }).httpStatus).toBe(429);
    expect(new AppError("Provider down", { code: "PROVIDER_ERROR" }).httpStatus).toBe(502);
  });

  it("allows an explicit HTTP status override", () => {
    expect(new AppError("Teapot", { code: "INTERNAL", httpStatus: 418 }).httpStatus).toBe(418);
  });

  it("keeps the underlying cause for server-side logging", () => {
    const cause = new Error("upstream failure");
    expect(new AppError("Wrapped", { cause }).cause).toBe(cause);
  });
});

describe("isAppError", () => {
  it("recognises AppError instances only", () => {
    expect(isAppError(new AppError("x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("x")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("toAppError", () => {
  it("returns the original AppError unchanged", () => {
    const original = new AppError("Owned", { code: "NOT_FOUND" });
    expect(toAppError(original, "fallback")).toBe(original);
  });

  it("wraps unknown throwables and preserves them as the cause", () => {
    const cause = new Error("db exploded");
    const wrapped = toAppError(cause, "Could not load the page");

    expect(wrapped.code).toBe("INTERNAL");
    expect(wrapped.message).toBe("Could not load the page");
    expect(wrapped.cause).toBe(cause);
  });

  it("handles non-Error throwables", () => {
    const wrapped = toAppError({ reason: "unexpected" }, "Unexpected failure");
    expect(wrapped.message).toBe("Unexpected failure");
  });
});

describe("toPublicError", () => {
  it("exposes the safe fields of an AppError", () => {
    const error = new AppError("This conversation does not belong to you", { code: "FORBIDDEN" });

    expect(toPublicError(error)).toEqual({
      code: "FORBIDDEN",
      status: 403,
      message: "This conversation does not belong to you",
    });
  });

  it("never leaks internals for unexpected errors", () => {
    const error = new Error("connection string postgres://user:secret@host/db failed");
    const publicError = toPublicError(error);

    expect(publicError).toEqual({
      code: "INTERNAL",
      status: 500,
      message: GENERIC_ERROR_MESSAGE,
    });
    expect(JSON.stringify(publicError)).not.toContain("secret");
  });
});
