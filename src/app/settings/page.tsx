import { KeyRound, SlidersHorizontal, Wallet } from "lucide-react";
import type { Metadata } from "next";

import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { ProfileForm } from "@/components/settings/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your Rowan profile and account details.",
};

/** Later-phase settings, still shown as planned rather than as dead controls. */
const PLANNED_SETTING_GROUPS = [
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
] as const;

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" }).format(value);
}

/**
 * Profile page.
 *
 * What is editable is editable; what is a fact about the account is displayed as a fact.
 * The account row is read through the same authenticated, RLS-scoped path as everything
 * else — nothing on this page can show another account's data.
 */
export default async function SettingsProfilePage() {
  const user = await getCurrentUser();

  // The layout already guarantees a user; this keeps the page safe if it is ever rendered
  // outside that layout (for example in a test).
  if (user === null) {
    return null;
  }

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How Rowan addresses you. Only you can see these fields.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm displayName={user.displayName} timezone={user.timezone} bio={user.bio} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Facts about this account. Change them in Security.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">Email</dt>
              <dd className="text-sm break-all">{user.email}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Email status
              </dt>
              <dd className="text-sm">
                {user.emailVerified ? (
                  <Badge variant="secondary">Confirmed</Badge>
                ) : (
                  <Badge variant="outline">Not confirmed</Badge>
                )}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Account created
              </dt>
              <dd className="text-sm">{formatDate(user.accountCreatedAt)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">Last active</dt>
              <dd className="text-sm">
                {user.lastSeenAt === null ? "This session" : `${formatDate(user.lastSeenAt)} (UTC)`}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold tracking-tight">Coming in later phases</h2>
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
        <PlannedFeatureNotice phase={3} title="Provider connections">
          Rowan does not call any AI provider yet, and stores no provider key. Phase 3 adds key
          storage and the provider adapters; until then the chat surface stays inert by design.
        </PlannedFeatureNotice>
      </section>
    </div>
  );
}
