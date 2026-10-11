import { describe, expect, it } from "vitest";

import { safeRedirectPath, signInPathFor } from "@/lib/auth/redirects";
import { defaultAuthenticatedPath } from "@/lib/auth/routes";

/**
 * Open-redirect protection.
 *
 * A `next` parameter is attacker-controlled: it arrives in a URL, and a link that leaves
 * Rowan's origin is indistinguishable from a phishing page wearing Rowan's address. These
 * cases are the canonical bypass attempts, and each one must fall back rather than pass
 * through.
 */
describe("safeRedirectPath", () => {
  it("keeps same-origin paths, including query and fragment", () => {
    expect(safeRedirectPath("/settings")).toBe("/settings");
    expect(safeRedirectPath("/settings/security?tab=sessions")).toBe(
      "/settings/security?tab=sessions",
    );
    expect(safeRedirectPath("/settings#sessions")).toBe("/settings#sessions");
  });

  it("trims surrounding whitespace before deciding", () => {
    expect(safeRedirectPath("  /settings  ")).toBe("/settings");
  });

  it("rejects absolute URLs, including same-scheme ones", () => {
    expect(safeRedirectPath("https://evil.example.com/steal")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("http://evil.example.com")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("javascript:alert(1)")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("data:text/html,<script>1</script>")).toBe(defaultAuthenticatedPath);
  });

  it("rejects protocol-relative and backslash variants", () => {
    expect(safeRedirectPath("//evil.example.com")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("/\\evil.example.com")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("\\\\evil.example.com")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("/settings\\..\\..\\etc")).toBe(defaultAuthenticatedPath);
  });

  it("rejects values that are not paths at all", () => {
    expect(safeRedirectPath(undefined)).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath(null)).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath(42)).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("settings")).toBe(defaultAuthenticatedPath);
  });

  it("rejects control characters", () => {
    expect(safeRedirectPath("/settings\nSet-Cookie: a=b")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("/settings\u0000")).toBe(defaultAuthenticatedPath);
  });

  it("rejects absurdly long values", () => {
    expect(safeRedirectPath(`/${"a".repeat(600)}`)).toBe(defaultAuthenticatedPath);
  });

  it("does not send anyone in a loop through the auth routes", () => {
    expect(safeRedirectPath("/auth/callback?code=x")).toBe(defaultAuthenticatedPath);
    expect(safeRedirectPath("/auth/confirm")).toBe(defaultAuthenticatedPath);
  });

  it("honours an explicit fallback", () => {
    expect(safeRedirectPath("https://evil.example.com", "/sign-in")).toBe("/sign-in");
  });
});

describe("signInPathFor", () => {
  it("encodes the destination so it survives the round trip", () => {
    expect(signInPathFor("/settings/security")).toBe("/sign-in?next=%2Fsettings%2Fsecurity");
  });

  it("produces a value that validates back to itself", () => {
    const path = signInPathFor("/settings?tab=profile");

    expect(safeRedirectPath(new URL(path, "https://rowan.invalid").searchParams.get("next"))).toBe(
      "/settings?tab=profile",
    );
  });
});
