import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Confirm your email",
  description: "Confirm your email address to activate your Rowan account.",
};

/**
 * "Check your inbox" page.
 *
 * It deliberately does not echo an address from the query string: the resend form asks for
 * it instead, which keeps email addresses out of URLs, browser history, and logs.
 */
export default async function VerifyEmailPage() {
  const user = await getCurrentUser();

  // Signed in already means the address was confirmed (or confirmation is disabled).
  if (user !== null && user.emailVerified) {
    redirect(defaultAuthenticatedPath);
  }

  return (
    <AuthCard
      title="Confirm your email"
      description="Open the link we emailed you to activate the account. The link expires after one hour."
    >
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm leading-relaxed">
          Nothing arrived? Check spam first, then send a new link. Only the newest link works.
        </p>
        <ResendVerificationForm />
        <p className="text-sm">
          <Link className="underline underline-offset-4" href={authRoutes.signIn}>
            Back to sign in
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
