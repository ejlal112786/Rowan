import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";

/**
 * Redirect-target validation.
 *
 * Every flow that accepts "where should we send you next" (`?next=`, `redirectTo`) can be
 * turned into an open redirect, which is how phishing links borrow a trusted domain.
 * Rowan only ever redirects to a path on its own origin, so the value is validated as a
 * *relative path* rather than sanitised into one:
 *
 *   - must start with a single `/`
 *   - must not start with `//` or `/\` (protocol-relative and backslash tricks)
 *   - must not contain a backslash, a control character, or whitespace at either end
 *   - must parse to a path that stays on the placeholder origin
 *   - is capped so a hostile value cannot bloat a header
 *
 * Anything that fails is replaced by the fallback: the caller never has to decide what
 * "a bit invalid" means.
 */

const MAX_REDIRECT_LENGTH = 512;
const PLACEHOLDER_ORIGIN = "https://rowan.invalid";

export function safeRedirectPath(
  value: unknown,
  fallback: string = defaultAuthenticatedPath,
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const candidate = value.trim();

  if (
    candidate.length === 0 ||
    candidate.length > MAX_REDIRECT_LENGTH ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\") ||
    candidate.includes("\\") ||
    // Control characters have no legitimate place in a path.
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(candidate, PLACEHOLDER_ORIGIN);

    if (parsed.origin !== PLACEHOLDER_ORIGIN) {
      return fallback;
    }

    // Refuse redirect targets that are themselves auth routes: a loop through the
    // sign-in page is always a mistake, and it hides the destination from the user.
    if (parsed.pathname.startsWith("/auth/")) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Build the sign-in URL for a protected destination, so the user lands where they were
 * heading after signing in.
 */
export function signInPathFor(next: string): string {
  return `${authRoutes.signIn}?next=${encodeURIComponent(next)}`;
}
