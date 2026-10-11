import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { safeRedirectPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/auth/server-client";
import { getSessionOutcome } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * `token_hash` landing point.
 *
 * This is the recommended endpoint for emailed links (`/auth/confirm?token_hash=…&type=…`):
 * the token is verified server-side, exchanged for a session, and never handled by client
 * JavaScript. Every link type the provider can send is listed explicitly — an unknown
 * `type` is refused rather than forwarded, so the parameter cannot be used to reach an
 * unintended verification path.
 */
const ALLOWED_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const satisfies readonly EmailOtpType[];

function isAllowedType(value: string | null): value is (typeof ALLOWED_OTP_TYPES)[number] {
  return value !== null && (ALLOWED_OTP_TYPES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const fallback = type === "recovery" ? authRoutes.resetPassword : defaultAuthenticatedPath;
  const next = safeRedirectPath(url.searchParams.get("next"), fallback);

  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL(`${authRoutes.error}?reason=not-configured`, url.origin));
  }

  if (tokenHash === null || tokenHash === "" || !isAllowedType(type)) {
    return NextResponse.redirect(new URL(`${authRoutes.error}?reason=link-invalid`, url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error !== null || data.user === null) {
    logger.warn("Email link verification failed", {
      providerCode: error?.code ?? "unknown",
      linkType: type,
    });

    return NextResponse.redirect(new URL(`${authRoutes.error}?reason=link-invalid`, url.origin));
  }

  try {
    await getSessionOutcome();
  } catch (error) {
    logger.error("Email link bookkeeping failed", {
      userId: data.user.id,
      ...(error instanceof Error ? { name: error.name } : {}),
    });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
