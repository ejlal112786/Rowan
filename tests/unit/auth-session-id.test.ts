import { describe, expect, it } from "vitest";

import { normalizeUserAgent } from "@/lib/data/sessions";
import { readSessionIdFromAccessToken } from "@/lib/auth/session";
import { authCookieOptions, withAuthCookiePolicy } from "@/lib/auth/cookie-options";

/**
 * Session-identifier handling and cookie policy.
 *
 * The session id is read from the provider's access token and used as a key into Rowan's
 * revocation list. It is treated as opaque data: recognised only if it matches the shape the
 * schema accepts, and never trusted for identity (identity always comes from `getUser()`,
 * which the provider verifies).
 */
function buildToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${header}.${body}.signature`;
}

describe("readSessionIdFromAccessToken", () => {
  it("reads a well-formed session id", () => {
    const token = buildToken({
      sub: "b9f4f4c2-6d4a-4a1f-9d2f-3c2a1b0d9e8f",
      session_id: "1e3f9a1c-2b3d-4e5f-8a9b-0c1d2e3f4a5b",
      exp: 4_000_000_000,
    });

    expect(readSessionIdFromAccessToken(token)).toBe("1e3f9a1c-2b3d-4e5f-8a9b-0c1d2e3f4a5b");
  });

  it("accepts an opaque identifier in the documented character set", () => {
    const token = buildToken({ session_id: "sess:0123456789abcdef" });

    expect(readSessionIdFromAccessToken(token)).toBe("sess:0123456789abcdef");
  });

  it("returns null when the claim is missing", () => {
    expect(readSessionIdFromAccessToken(buildToken({ sub: "someone" }))).toBeNull();
  });

  it("returns null for a claim that does not match the accepted shape", () => {
    expect(readSessionIdFromAccessToken(buildToken({ session_id: "short" }))).toBeNull();
    expect(readSessionIdFromAccessToken(buildToken({ session_id: "has spaces in it" }))).toBeNull();
    expect(readSessionIdFromAccessToken(buildToken({ session_id: 12345 }))).toBeNull();
    expect(readSessionIdFromAccessToken(buildToken({ session_id: "a".repeat(200) }))).toBeNull();
  });

  it("returns null for malformed tokens instead of throwing", () => {
    expect(readSessionIdFromAccessToken("not-a-token")).toBeNull();
    expect(readSessionIdFromAccessToken("a.b")).toBeNull();
    expect(readSessionIdFromAccessToken("a.!!!not-base64!!!.c")).toBeNull();
    expect(readSessionIdFromAccessToken(undefined)).toBeNull();
    expect(readSessionIdFromAccessToken(null)).toBeNull();
    expect(readSessionIdFromAccessToken(42)).toBeNull();
  });
});

describe("normalizeUserAgent", () => {
  it("keeps a readable value", () => {
    expect(normalizeUserAgent("Mozilla/5.0 (Macintosh)")).toBe("Mozilla/5.0 (Macintosh)");
  });

  it("maps empty and absent values to null", () => {
    expect(normalizeUserAgent("")).toBeNull();
    expect(normalizeUserAgent("   ")).toBeNull();
    expect(normalizeUserAgent(null)).toBeNull();
    expect(normalizeUserAgent(undefined)).toBeNull();
  });

  it("strips control characters and caps the length", () => {
    const result = normalizeUserAgent(`Mozilla\u0000/5.0\u001f${"x".repeat(500)}`);

    expect(result).not.toBeNull();
    expect(result).not.toContain("\u0000");
    expect((result ?? "").length).toBeLessThanOrEqual(300);
  });
});

describe("auth cookie policy", () => {
  it("always requires httpOnly, SameSite=Lax, and path=/", () => {
    const options = authCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("overrides any weaker suggestion from the provider", () => {
    const merged = withAuthCookiePolicy({ httpOnly: false, sameSite: "none", path: "/auth" });

    expect(merged.httpOnly).toBe(true);
    expect(merged.sameSite).toBe("lax");
    expect(merged.path).toBe("/");
  });

  it("keeps provider values that do not weaken the policy", () => {
    const merged = withAuthCookiePolicy({ maxAge: 3600 });

    expect(merged.maxAge).toBe(3600);
  });
});
