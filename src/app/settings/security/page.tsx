import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DangerZone } from "@/components/settings/danger-zone";
import { PasswordForm } from "@/components/settings/password-form";
import { SessionList } from "@/components/settings/session-list";
import { SignOutEverywhereForm } from "@/components/settings/sign-out-everywhere-form";
import { withUserContext } from "@/lib/db/query";
import { listSessions } from "@/lib/data/sessions";
import { authRoutes } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Security",
  description: "Password, sessions, and account deletion for your Rowan account.",
};

/**
 * Account security.
 *
 * Everything here maps to a real control:
 *
 *   - the password form changes the credential and ends other sessions;
 *   - the session list is the revocation list, read from `public.user_sessions` and
 *     filtered to this user by row-level security;
 *   - "sign out of all devices" revokes every session and every provider refresh token;
 *   - deletion removes the account and its rows.
 *
 * None of these are simulated: if the database is unreachable, the page fails rather than
 * showing controls that would not do anything.
 */
export default async function SettingsSecurityPage() {
  const user = await getCurrentUser();

  if (user === null) {
    redirect(authRoutes.signIn);
  }

  const sessions = await withUserContext(user.id, async (context) => listSessions(context));

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Handled by the authentication provider; Rowan never stores or sees your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Every session Rowan has seen for this account. Revoking one ends it immediately, even
            though its token has not expired.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <SessionList sessions={sessions} currentSessionId={user.sessionId} />
          <div className="border-border border-t pt-4">
            <SignOutEverywhereForm />
            <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
              Signs out every browser and device, including this one.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>Remove the account and every row owned by it.</CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone email={user.email} />
        </CardContent>
      </Card>
    </div>
  );
}
