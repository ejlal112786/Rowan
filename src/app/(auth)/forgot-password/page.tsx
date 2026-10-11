import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { isAuthConfigured } from "@/lib/auth/server-client";
import { getSessionOutcome } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Request a password-reset link for your Rowan account.",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const outcome = await getSessionOutcome();

  if (outcome.status === "authenticated") {
    redirect(defaultAuthenticatedPath);
  }

  const reason = Array.isArray(params.reason) ? params.reason[0] : params.reason;

  if (!isAuthConfigured() || outcome.status === "unavailable") {
    return (
      <AuthCard title="Reset password" description="Not available in this deployment yet.">
        <PlannedFeatureNotice phase={2} title="Authentication is not configured">
          This deployment has no authentication provider configured, so no reset email can be sent.
        </PlannedFeatureNotice>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset password"
      description="We email a single-use link. It expires after one hour."
      footer={
        <p className="text-muted-foreground text-xs leading-relaxed">
          Remembered it?{" "}
          <Link className="underline underline-offset-4" href={authRoutes.signIn}>
            Back to sign in
          </Link>
          .
        </p>
      }
    >
      {reason === "link-expired" ? (
        <p
          role="alert"
          className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm leading-relaxed"
        >
          That recovery link is no longer valid. Request a new one below.
        </p>
      ) : null}
      <ForgotPasswordForm />
    </AuthCard>
  );
}
