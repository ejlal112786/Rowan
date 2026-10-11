import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignInForm } from "@/components/auth/sign-in-form";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { isAuthConfigured } from "@/lib/auth/server-client";
import { safeRedirectPath } from "@/lib/auth/redirects";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { getSessionOutcome } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Rowan account.",
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Explain what just happened, when the user arrived here from another flow. */
function noticeFor(params: SearchParams): string | undefined {
  if (first(params.reason) === "session-ended") {
    return "That session was ended, so you were signed out. Sign in again to continue.";
  }

  if (first(params.signedOut) !== undefined) {
    return "You are signed out.";
  }

  if (first(params.deleted) !== undefined) {
    return "Your account and its data have been deleted.";
  }

  return undefined;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(first(params.next), defaultAuthenticatedPath);
  const notice = noticeFor(params);
  const outcome = await getSessionOutcome();

  // Someone who is already signed in has no reason to see this page.
  if (outcome.status === "authenticated") {
    redirect(next);
  }

  if (!isAuthConfigured() || outcome.status === "unavailable") {
    return (
      <AuthCard
        title="Sign in"
        description="Authentication is not available in this deployment yet."
      >
        <PlannedFeatureNotice phase={2} title="Authentication is not configured">
          This deployment has no authentication provider configured (<code>SUPABASE_URL</code> and{" "}
          <code>SUPABASE_ANON_KEY</code> are unset). See the environment section of the README, and{" "}
          <Link className="underline underline-offset-4" href="/">
            return to the workspace
          </Link>
          .
        </PlannedFeatureNotice>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Sign in"
      description="Use the email address and password you registered with."
      footer={
        <p className="text-muted-foreground text-xs leading-relaxed">
          No account yet?{" "}
          <Link className="underline underline-offset-4" href={authRoutes.signUp}>
            Create one
          </Link>
          .
        </p>
      }
    >
      {notice === undefined ? (
        <SignInForm next={next} />
      ) : (
        <SignInForm next={next} notice={notice} />
      )}
    </AuthCard>
  );
}
