import { NextResponse, type NextRequest } from "next/server";

import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { safeRedirectPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/auth/server-client";
import { getSessionOutcome } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * PKCE landing point.
 *
 * Supabase confirmation and recovery emails can be configured to send users here with a
 * `code` after the provider has verified the link. Exchanging it establishes the session
 * cookie, so this handler runs the whole flow server-side: the code is never exposed to
 * client JavaScript and never lands in the browser's history as a fragment.
 *
 * `next` is validated as a same-origin path before use — a redirect target that arrives in
 * a URL is untrusted input, not configuration.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const fallback = type === "recovery" ? authRoutes.resetPassword : defaultAuthenticatedPath;
  const next = safeRedirectPath(url.searchParams.get("next"), fallback);

  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL(`${authRoutes.error}?reason=not-configured`, url.origin));
  }

  if (code === null || code === "") {
    return NextResponse.redirect(new URL(`${authRoutes.error}?reason=missing-code`, url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error !== null || data.user === null) {
    logger.warn("Auth callback could not exchange the code", {
      providerCode: error?.code ?? "unknown",
    });

    return NextResponse.redirect(new URL(`${authRoutes.error}?reason=link-invalid`, url.origin));
  }

  try {
    // Provisions the account mirror and records the session before the user lands on a
    // page that reads their own rows.
    await getSessionOutcome();
  } catch (error) {
    logger.error("Auth callback bookkeeping failed", {
      userId: data.user.id,
      ...(error instanceof Error ? { name: error.name } : {}),
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
