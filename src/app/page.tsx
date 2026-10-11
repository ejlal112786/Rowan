import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-shell";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { Badge } from "@/components/ui/badge";
import { ComposerPreview } from "@/components/welcome/composer-preview";
import { ProviderReadiness } from "@/components/welcome/provider-readiness";
import { WorkspaceReadiness } from "@/components/welcome/workspace-readiness";
import { appConfig } from "@/config/app";

export const metadata: Metadata = {
  title: "Workspace",
  description: appConfig.description,
};

/**
 * First-use workspace.
 *
 * This is the real entry point of the application shell, not a placeholder
 * screen: it states what Rowan is, shows where conversations will happen, and
 * reports the honest build status.
 */
export default function WorkspacePage() {
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
          capability plugs into; it does not call any AI provider, and it does not store anything
          yet.
        </p>
      </section>

      <ComposerPreview />

      <div className="grid gap-6 lg:grid-cols-2">
        <WorkspaceReadiness />
        <ProviderReadiness />
      </div>

      <PlannedFeatureNotice phase={appConfig.phase.next.number} title={appConfig.phase.next.title}>
        Database schema, ownership-enforcing queries, registration, sign-in, sessions, and account
        management are the next phase. Until then this shell has no user records at all.
      </PlannedFeatureNotice>
    </PageContainer>
  );
}
