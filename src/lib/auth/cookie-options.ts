/**
 * Cookie policy for authentication cookies.
 *
 * Lives outside `server-client.ts` on purpose: the proxy (Next's request pipeline, which
 * runs outside the React Server Component graph) must apply exactly the same policy, and
 * that module cannot import a `server-only` module.
 *
 * The policy itself:
 *
 *   - `httpOnly` — no script can read the session, so an injected script cannot steal it.
 *   - `secure` in production — the cookie never travels in clear text.
 *   - `sameSite: "lax"` — sent on top-level navigation (which email links are) but not on
 *     cross-site subrequests, which is the CSRF-relevant case.
 *   - `path: "/"` — one session for the whole application.
 *
 * Rowan never writes session material to `localStorage` or `sessionStorage`; there is no
 * browser-readable copy of a token anywhere in the application.
 */

export type AuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
};

export function authCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}

/**
 * Apply the policy to whatever the provider suggested.
 *
 * The provider's options are treated as a starting point, not as a decision: any value
 * that would weaken the policy is replaced.
 */
export function withAuthCookiePolicy(
  options: Record<string, unknown> | undefined,
): AuthCookieOptions & Record<string, unknown> {
  return { ...options, ...authCookieOptions() };
}
