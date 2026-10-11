import type { ReactNode } from "react";

import { PageContainer, PageHeader } from "@/components/layout/page-shell";
import { SettingsNav } from "@/components/settings/settings-nav";
import { requireUser } from "@/lib/auth/session";

/**
 * Account settings layout.
 *
 * The whole subtree requires an authenticated user, enforced here on the server before any
 * child renders: `requireUser()` redirects to sign-in and carries the destination, so the
 * user resumes where they were heading. The proxy performs the same check earlier for the
 * common case; this one is the guarantee that does not depend on the request pipeline
 * (docs/SECURITY.md §3).
 */
/**
 * Every route below this layout depends on the request's session, so it must never be
 * prerendered: a static render would bake in whatever state the build machine had (no
 * cookies), and the build machine is not the visitor.
 */
export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/settings");

  return (
    <PageContainer>
      <PageHeader
        title="Account settings"
        description={`Signed in as ${user.email}. Your profile, password, and sessions are managed here.`}
      />
      <SettingsNav />
      {children}
    </PageContainer>
  );
}
