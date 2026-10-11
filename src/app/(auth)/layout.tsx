import type { ReactNode } from "react";

import { BrandLink } from "@/components/brand/brand-link";

/**
 * Layout for the authentication pages.
 *
 * A centred column instead of the application shell: someone signing in has no sessions,
 * no navigation, and no conversation list to look at, so the shell's sidebar would only
 * offer controls that cannot work yet.
 */
/**
 * Every route below this layout depends on the request's session, so it must never be
 * prerendered: a static render would bake in whatever state the build machine had (no
 * cookies), and the build machine is not the visitor.
 */
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-12">
      <BrandLink withTagline />
      {children}
    </div>
  );
}
