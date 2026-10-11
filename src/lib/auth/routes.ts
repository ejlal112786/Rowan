/**
 * Route inventory for authentication.
 *
 * Keeping the paths in one place means the proxy, the server actions, the email
 * redirects, and the tests all agree on them — a redirect that points at a renamed route
 * is a silent, user-visible break that no type checker would catch otherwise.
 */

export const authRoutes = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
  /** PKCE landing page for email links that carry a `code` parameter. */
  callback: "/auth/callback",
  /** Lands `token_hash` links (email confirmation, recovery) and verifies them. */
  confirm: "/auth/confirm",
  /** Ends a local session and clears cookies; used when a session was revoked. */
  signOutHandler: "/auth/sign-out",
  error: "/auth/error",
} as const;

export type AuthRoute = (typeof authRoutes)[keyof typeof authRoutes];

/** Where a signed-in user is sent when they asked for nothing in particular. */
export const defaultAuthenticatedPath = "/settings";

/** Where an unauthenticated user is sent when they asked for nothing in particular. */
export const defaultPublicPath = "/";

/**
 * Paths that require an authenticated user.
 *
 * The list is deliberately about *data ownership*: only surfaces that read or write a
 * user's own rows are protected. The chat shell and the planning pages stay reachable,
 * because they hold no account data yet and say so.
 */
export const protectedPathPrefixes = ["/settings"] as const;

/** Pages that exist only for signed-out users; a signed-in user is sent onward. */
export const guestOnlyPaths = [
  authRoutes.signIn,
  authRoutes.signUp,
  authRoutes.forgotPassword,
] as const;

export function isProtectedPath(pathname: string): boolean {
  return protectedPathPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isGuestOnlyPath(pathname: string): boolean {
  return guestOnlyPaths.some((path) => pathname === path);
}
