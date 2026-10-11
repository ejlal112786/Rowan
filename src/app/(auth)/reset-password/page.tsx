import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { authRoutes } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Set a new password",
  description: "Choose a new password for your Rowan account.",
};

/**
 * Set a new password.
 *
 * A recovery link establishes a short-lived session before landing here, so the form is
 * only shown to someone who actually followed one. Without a session the page explains
 * how to get a link instead of rendering a form that could not work.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  if (user === null) {
    return (
      <AuthCard title="Set a new password" description="This page needs a valid recovery link.">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Recovery links expire after one hour and can be used once. Request a new one and open it
          in this browser.
        </p>
        <p className="text-sm">
          <Link
            className="underline underline-offset-4"
            href={`${authRoutes.forgotPassword}?reason=link-expired`}
          >
            Request a new reset link
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set a new password"
      description={`Choose a new password for ${user.email}.`}
      footer={
        <p className="text-muted-foreground text-xs leading-relaxed">
          Updating your password signs out every other device.
        </p>
      }
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
