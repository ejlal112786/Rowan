import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { getServerEnv, parseServerEnv } from "@/lib/env/server";

describe("parseServerEnv", () => {
  it("applies safe defaults when nothing is configured", () => {
    expect(parseServerEnv({})).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      VERCEL_ENV: undefined,
    });
  });

  it("accepts explicit valid values", () => {
    expect(
      parseServerEnv({
        NODE_ENV: "production",
        LOG_LEVEL: "debug",
        VERCEL_ENV: "preview",
      }),
    ).toEqual({
      NODE_ENV: "production",
      LOG_LEVEL: "debug",
      VERCEL_ENV: "preview",
    });
  });

  it("treats blank values as unset and falls back to defaults", () => {
    expect(parseServerEnv({ NODE_ENV: "  ", LOG_LEVEL: "" })).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      VERCEL_ENV: undefined,
    });
  });

  it("rejects an unsupported NODE_ENV", () => {
    expect(() => parseServerEnv({ NODE_ENV: "staging" })).toThrowError(AppError);

    try {
      parseServerEnv({ NODE_ENV: "staging" });
      expect.unreachable("parseServerEnv should have thrown");
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe("ENV_INVALID");
      expect(appError.message).toContain("NODE_ENV");
    }
  });

  it("rejects an unsupported LOG_LEVEL", () => {
    try {
      parseServerEnv({ LOG_LEVEL: "verbose" });
      expect.unreachable("parseServerEnv should have thrown");
    } catch (error) {
      const appError = error as AppError;
      expect(appError.code).toBe("ENV_INVALID");
      expect(appError.message).toContain("LOG_LEVEL");
    }
  });

  it("ignores platform-owned variables it does not recognise", () => {
    // Vercel owns VERCEL_ENV; an unexpected value must not break a deployment.
    expect(parseServerEnv({ VERCEL_ENV: "something-new" }).VERCEL_ENV).toBeUndefined();
  });
});

describe("getServerEnv", () => {
  it("reads the process environment and is memoised", () => {
    const first = getServerEnv();
    const second = getServerEnv();

    expect(first).toBe(second);
    expect(first.NODE_ENV).toBe(process.env.NODE_ENV);
  });

  it("requires no database or provider credentials", () => {
    const env = getServerEnv();
    expect(Object.keys(env).sort()).toEqual(["LOG_LEVEL", "NODE_ENV", "VERCEL_ENV"]);
  });
});
