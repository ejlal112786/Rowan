import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { authCookieOptions, withAuthCookiePolicy } from "@/lib/auth/cookie-options";
import {
  authRoutes,
  defaultAuthenticatedPath,
  isGuestOnlyPath,
  isProtectedPath,
} from "@/lib/auth/routes";

/**
 * Request pipeline ("proxy" — the file Next.js 16 previously called middleware).
 *
 * Two jobs, both about cookies and redirects only:
 *
 *   1. **Refresh the session.** Supabase rotates access tokens with a refresh token kept in
 *      an httpOnly cookie. Refreshing must happen where cookies can be written on the way
 *      out, which is here; Server Components can only read them.
 *   2. **Route protection.** A protected path with no session is redirected to sign-in
 *      *before* any page code runs, so an unauthenticated visitor never reaches a surface
 *      that reads their rows.
 *
 * What this file deliberately does **not** do:
 *
 *   - It does not decide authorization. It cannot: revocation lives in PostgreSQL
 *     (`public.user_sessions`) and this runs in the Edge runtime with no database access.
 *     Session revocation is enforced on every authenticated data path in
 *     `src/lib/auth/session.ts`, and this proxy would only ever *add* a redirect, never
 *     access.
 *   - It does not validate the session for identity. `getUser()` is called for its
 *     side effect of refreshing the cookie; identity is established later, server-side.
 *
 * Because this module is not part of the React Server Component graph, it reads the two
 * public Supabase values directly from `process.env` instead of the `server-only`
 * environment module (which refuses to load outside that graph).
 */

const PUBLIC_SUPABASE_ENV = {
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
} as const;

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { url, anonKey } = PUBLIC_SUPABASE_ENV;

  // Without a configured provider there is no session to refresh and no sign-in to
  // redirect to; the pages themselves explain the state honestly.
  if (url === undefined || anonKey === undefined || url === "" || anonKey === "") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookieOptions: { ...authCookieOptions() },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Persist on the request too, so the code rendering this request already sees the
        // refreshed values.
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }

        response = NextResponse.next({ request });

        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, withAuthCookiePolicy(options));
        }

        // Cache-control headers that must accompany a response which sets auth cookies —
        // without them a CDN could serve one user's session cookie to another.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (user === null && isProtectedPath(pathname)) {
    const signInUrl = new URL(authRoutes.signIn, request.url);
    signInUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);

    return NextResponse.redirect(signInUrl);
  }

  if (user !== null && isGuestOnlyPath(pathname)) {
    return NextResponse.redirect(new URL(defaultAuthenticatedPath, request.url));
  }

  return response;
}

/**
 * Match everything except Next.js internals, the icon, and static assets: authenticated
 * pages must still pass through here, because this is where tokens are refreshed. The value
 * has to be written inline — Next.js parses it statically at build time.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
