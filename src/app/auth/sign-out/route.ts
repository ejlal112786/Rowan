import { NextResponse, type NextRequest } from "next/server";

import { withUserContext } from "@/lib/db/query";
import { revokeSession } from "@/lib/data/sessions";
import { authRoutes } from "@/lib/auth/routes";
import { safeRedirectPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient, isAuthConfigured } from "@/lib/auth/server-client";
import { getSessionOutcome } from "@/lib/auth/session";
import { logger } from "@/lib/logger";

/**
 * Cookie-cleanup sign-out.
 *
 * Used when the application has already decided the browser should not keep its session
 * cookies: a session revoked elsewhere (signed out on another device, password changed,
 * account deleted), where `requireUser` routes through here before sending the user to
 * sign in. It revokes the session record when one is still resolvable, ends the local
 * session at the provider, and always clears the cookies.
 *
 * `GET` is used deliberately: this is reached by a redirect, and the only effect an
 * attacker could cause by luring someone here is signing them out. Rowan's cookies are
 * `SameSite=Lax`, so a cross-site request does not even carry the session.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = safeRedirectPath(url.searchParams.get("next"), authRoutes.signIn);
  const reason = url.searchParams.get("reason");

  if (isAuthConfigured()) {
    try {
      const outcome = await getSessionOutcome();

      if (outcome.status === "authenticated") {
        const { user } = outcome;
        const sessionId = user.sessionId;

        if (sessionId !== null) {
          await withUserContext(user.id, async (context) => {
            await revokeSession(context, sessionId, "sign-out-handler");
          });
        }
      }
    } catch (error) {
      // Cleanup is best-effort: the redirect below must happen either way.
      logger.warn("Sign-out handler could not revoke the session", {
        ...(error instanceof Error ? { name: error.name } : {}),
      });
    }

    try {
      const supabase = await createSupabaseServerClient();
      await supabase.auth.signOut({ scope: "local" });
    } catch (error) {
      logger.warn("Sign-out handler could not end the provider session", {
        ...(error instanceof Error ? { name: error.name } : {}),
      });
    }
  }

  const target = new URL(next, url.origin);

  if (reason !== null) {
    target.searchParams.set("reason", reason);
  }

  return NextResponse.redirect(target);
}
