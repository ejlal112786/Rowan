import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { isAuthConfigured } from "@/lib/auth/server-client";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { getSessionOutcome } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a Rowan account.",
};

export default async function SignUpPage() {
  const outcome = await getSessionOutcome();

  if (outcome.status === "authenticated") {
    redirect(defaultAuthenticatedPath);
  }

  if (!isAuthConfigured() || outcome.status === "unavailable") {
    return (
      <AuthCard
        title="Create account"
        description="Account creation is not available in this deployment yet."
      >
        <PlannedFeatureNotice phase={2} title="Authentication is not configured">
          This deployment has no authentication provider configured. See the environment section of
          the README, and{" "}
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
      title="Create account"
      description="Rowan sends one confirmation email, then you are ready to work."
      footer={
        <p className="text-muted-foreground text-xs leading-relaxed">
          Already registered?{" "}
          <Link className="underline underline-offset-4" href={authRoutes.signIn}>
            Sign in
          </Link>
          .
        </p>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
