import { KeyRound, ShieldCheck, SlidersHorizontal, UserCog, Wallet } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-shell";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your account, provider keys, and assistants.",
};

type PlannedSettingGroup = {
  title: string;
  phase: number;
  icon: typeof UserCog;
  description: string;
};

const PLANNED_SETTING_GROUPS: readonly PlannedSettingGroup[] = [
  {
    title: "Account and profile",
    phase: 2,
    icon: UserCog,
    description: "Registration, sign-in, session management, and account deletion.",
  },
  {
    title: "Provider keys (BYOK)",
    phase: 3,
    icon: KeyRound,
    description: "Add and validate your own provider keys, stored encrypted and server-side only.",
  },
  {
    title: "Assistant instructions and prompt library",
    phase: 7,
    icon: SlidersHorizontal,
    description: "Default system instructions, reusable prompts, and per-conversation overrides.",
  },
  {
    title: "Usage, cost, and quotas",
    phase: 8,
    icon: Wallet,
    description: "Token usage per provider, cost estimates, budgets, and rate limits.",
  },
];

/**
 * Settings index.
 *
 * The page is an index of planned configuration. It contains no toggles, no
 * inputs, and no save action, because there is nothing to configure yet and a
 * control that silently does nothing would be misleading.
 */
export default function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Account, provider, and assistant configuration will live here. No setting is editable in this phase."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {PLANNED_SETTING_GROUPS.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <group.icon aria-hidden="true" className="text-muted-foreground size-4" />
                {group.title}
              </CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge variant="muted">Planned · Phase {group.phase}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <PlannedFeatureNotice phase={2} title="Security controls">
        <span className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Authentication, authorization, encrypted key storage, and audit logging are deliberately
            not implemented yet — see docs/SECURITY.md for the controls each later phase must add
            before Rowan is used with real provider keys.
          </span>
        </span>
      </PlannedFeatureNotice>
    </PageContainer>
  );
}
