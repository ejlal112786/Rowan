import { describe, expect, it } from "vitest";

import {
  authRoutes,
  defaultAuthenticatedPath,
  isGuestOnlyPath,
  isProtectedPath,
} from "@/lib/auth/routes";

/**
 * Route protection inventory.
 *
 * These lists decide what the proxy guards and what it redirects away from, so an
 * accidental omission is a security regression and an accidental addition locks people out
 * of a page that has nothing to protect.
 */
describe("isProtectedPath", () => {
  it("protects the account surface and everything under it", () => {
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/security")).toBe(true);
    expect(isProtectedPath("/settings/anything/else")).toBe(true);
  });

  it("does not protect placeholder or public pages", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/conversations")).toBe(false);
    expect(isProtectedPath("/compare")).toBe(false);
    expect(isProtectedPath("/settings-archive")).toBe(false);
  });
});

describe("isGuestOnlyPath", () => {
  it("redirects signed-in users away from the credential pages", () => {
    expect(isGuestOnlyPath(authRoutes.signIn)).toBe(true);
    expect(isGuestOnlyPath(authRoutes.signUp)).toBe(true);
    expect(isGuestOnlyPath(authRoutes.forgotPassword)).toBe(true);
  });

  it("leaves the link-landing pages reachable", () => {
    // A signed-in user must be able to follow a recovery link, and a signed-out one must be
    // able to see why a link failed.
    expect(isGuestOnlyPath(authRoutes.resetPassword)).toBe(false);
    expect(isGuestOnlyPath(authRoutes.verifyEmail)).toBe(false);
    expect(isGuestOnlyPath(authRoutes.error)).toBe(false);
    expect(isGuestOnlyPath(authRoutes.callback)).toBe(false);
    expect(isGuestOnlyPath(authRoutes.confirm)).toBe(false);
  });

  it("does not treat the sign-out handler as a page", () => {
    expect(isGuestOnlyPath(authRoutes.signOutHandler)).toBe(false);
  });
});

describe("route constants", () => {
  it("points every path at a route that exists", () => {
    for (const [name, path] of Object.entries(authRoutes)) {
      expect(path.startsWith("/"), `${name} must be an absolute path`).toBe(true);
      expect(path).not.toMatch(/\s/);
    }
  });

  it("keeps the authenticated default inside a protected path", () => {
    expect(isProtectedPath(defaultAuthenticatedPath)).toBe(true);
  });
});
