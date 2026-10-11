import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { getServerEnv, parseServerEnv } from "@/lib/env/server";

describe("parseServerEnv", () => {
  it("applies safe defaults when nothing is configured", () => {
    expect(parseServerEnv({})).toEqual({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
      VERCEL_ENV: undefined,
      DATABASE_URL: undefined,
      SUPABASE_URL: undefined,
      SUPABASE_ANON_KEY: undefined,
      SUPABASE_SERVICE_ROLE_KEY: undefined,
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

describe("parseServerEnv — Phase 2 database and auth variables", () => {
  it("accepts a PostgreSQL connection string", () => {
    const env = parseServerEnv({
      DATABASE_URL: "postgresql://rowan:secret@db.example.com:5432/postgres?sslmode=require",
    });

    expect(env.DATABASE_URL).toContain("postgresql://");
  });

  it("accepts the postgres:// scheme too", () => {
    expect(
      parseServerEnv({ DATABASE_URL: "postgres://user:pass@localhost:5432/rowan" }).DATABASE_URL,
    ).toBeDefined();
  });

  it("rejects a connection string that is not PostgreSQL", () => {
    try {
      parseServerEnv({ DATABASE_URL: "mysql://user:pass@localhost:3306/rowan" });
      expect.unreachable("parseServerEnv should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("ENV_INVALID");
      expect((error as AppError).message).toContain("DATABASE_URL");
    }
  });

  it("never echoes a rejected database URL", () => {
    const credential = "supersecretpassword";

    try {
      parseServerEnv({ DATABASE_URL: `mysql://user:${credential}@localhost/rowan` });
      expect.unreachable("parseServerEnv should have thrown");
    } catch (error) {
      expect((error as AppError).message).not.toContain(credential);
    }
  });

  it("validates the Supabase project URL", () => {
    expect(parseServerEnv({ SUPABASE_URL: "https://abcdefgh.supabase.co" }).SUPABASE_URL).toBe(
      "https://abcdefgh.supabase.co",
    );

    expect(() => parseServerEnv({ SUPABASE_URL: "not-a-url" })).toThrowError(AppError);
  });

  it("requires Supabase keys to look like keys", () => {
    expect(() => parseServerEnv({ SUPABASE_ANON_KEY: "short" })).toThrowError(AppError);
    expect(
      parseServerEnv({ SUPABASE_ANON_KEY: "sb_publishable_0123456789abcdef" }).SUPABASE_ANON_KEY,
    ).toBeDefined();
  });

  it("treats empty strings as unset, as every hosting platform may send them", () => {
    const env = parseServerEnv({
      DATABASE_URL: "  ",
      SUPABASE_URL: "",
      SUPABASE_ANON_KEY: "   ",
      SUPABASE_SERVICE_ROLE_KEY: "",
    });

    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_ANON_KEY).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});

describe("getServerEnv", () => {
  it("reads the process environment and is memoised", () => {
    const first = getServerEnv();
    const second = getServerEnv();

    expect(first).toBe(second);
    expect(first.NODE_ENV).toBe(process.env.NODE_ENV);
  });

  it("requires no database or provider credentials to start", () => {
    // The shell, the build, and CI must all work with an empty environment: every Phase 2
    // variable is optional at parse time, and the module that needs a value reports its
    // absence when it is used.
    const env = getServerEnv();

    expect(Object.keys(env).sort()).toEqual([
      "DATABASE_URL",
      "LOG_LEVEL",
      "NODE_ENV",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "SUPABASE_URL",
      "VERCEL_ENV",
    ]);
  });
});
