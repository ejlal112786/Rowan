import type { Metadata } from "next";
import Link from "next/link";

import { PageContainer } from "@/components/layout/page-shell";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { Badge } from "@/components/ui/badge";
import { ComposerPreview } from "@/components/welcome/composer-preview";
import { ProviderReadiness } from "@/components/welcome/provider-readiness";
import { WorkspaceReadiness } from "@/components/welcome/workspace-readiness";
import { appConfig } from "@/config/app";
import { authRoutes } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Workspace",
  description: appConfig.description,
};

/**
 * The workspace greets whoever is signed in, so it renders per request rather than being
 * prerendered with a signed-out shell.
 */
export const dynamic = "force-dynamic";

/**
 * First-use workspace.
 *
 * This is the real entry point of the application shell, not a placeholder
 * screen: it states what Rowan is, shows where conversations will happen, and
 * reports the honest build status.
 */
export default async function WorkspacePage() {
  // Cached for the request: the root layout already resolved the session.
  const user = await getCurrentUser();

  return (
    <PageContainer className="max-w-4xl gap-6">
      <section className="flex flex-col items-start gap-3 pt-2">
        <Badge variant="outline">
          Phase {appConfig.phase.current} of {appConfig.phase.total} · {appConfig.phase.title}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Welcome to {appConfig.name}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed sm:text-base">
          {appConfig.description}
        </p>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Rowan is being built in ten phases. The interface below is the real shell that every later
          capability plugs into. It does not call any AI provider yet — and it will not pretend to.
          Accounts, profiles, and sessions are real as of this phase, and you can manage them at any
          time.
        </p>

        {user === null ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            <Link className="text-foreground underline underline-offset-4" href={authRoutes.signIn}>
              Sign in
            </Link>{" "}
            or{" "}
            <Link className="text-foreground underline underline-offset-4" href={authRoutes.signUp}>
              create an account
            </Link>{" "}
            to set up your profile. Nothing is stored about you until you do.
          </p>
        ) : (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
            Signed in as <span className="text-foreground">{user.email}</span>.{" "}
            <Link className="text-foreground underline underline-offset-4" href="/settings">
              Account settings
            </Link>{" "}
            holds your profile, password, and sessions.
          </p>
        )}
      </section>

      <ComposerPreview />

      <div className="grid gap-6 lg:grid-cols-2">
        <WorkspaceReadiness />
        <ProviderReadiness />
      </div>

      <PlannedFeatureNotice phase={appConfig.phase.next.number} title={appConfig.phase.next.title}>
        Connecting a provider — storing a key, validating it, and listing the models it offers — is
        the next phase. Until then Rowan stores no provider key and makes no provider request.
      </PlannedFeatureNotice>
    </PageContainer>
  );
}
