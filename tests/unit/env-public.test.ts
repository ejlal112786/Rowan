import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { parsePublicEnv } from "@/lib/env/public";

describe("parsePublicEnv", () => {
  it("accepts an empty environment so the shell renders without configuration", () => {
    expect(parsePublicEnv({})).toEqual({});
  });

  it("treats empty and whitespace-only values as unset", () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_APP_URL: "" })).toEqual({});
    expect(parsePublicEnv({ NEXT_PUBLIC_APP_URL: "   " })).toEqual({});
  });

  it("trims and accepts an absolute URL", () => {
    expect(parsePublicEnv({ NEXT_PUBLIC_APP_URL: "  https://rowan.example.com  " })).toEqual({
      NEXT_PUBLIC_APP_URL: "https://rowan.example.com",
    });
  });

  it("rejects a relative URL with a diagnosable ENV_INVALID error", () => {
    try {
      parsePublicEnv({ NEXT_PUBLIC_APP_URL: "/relative/path" });
      expect.unreachable("parsePublicEnv should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("ENV_INVALID");
      expect(appError.message).toContain("NEXT_PUBLIC_APP_URL");
      expect(appError.message).toContain("absolute URL");
    }
  });

  it("does not require any variable to be present", () => {
    const parsed = parsePublicEnv({ UNRELATED: "ignored" });
    expect(parsed.NEXT_PUBLIC_APP_URL).toBeUndefined();
  });
});
