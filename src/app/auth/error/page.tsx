import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { authRoutes } from "@/lib/auth/routes";

export const metadata: Metadata = {
  title: "Link problem",
  description: "A confirmation or recovery link could not be used.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const EXPLANATIONS: Record<string, string> = {
  "link-invalid":
    "That link is invalid, already used, or expired. Links can be used once and expire after an hour.",
  "missing-code":
    "That link was missing the information needed to confirm it. Request a new one and open it in this browser.",
  "not-configured":
    "This deployment has no authentication provider configured, so links cannot be verified.",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Landing page for a link that could not be verified.
 *
 * It says what to do next rather than what went wrong technically: an expired link and a
 * tampered link are not distinguishable to the person holding it, and guessing wrong costs
 * them another email round-trip.
 */
export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const reason = first(params.reason) ?? "link-invalid";
  const explanation = EXPLANATIONS[reason] ?? EXPLANATIONS["link-invalid"];

  return (
    <AuthCard title="That link did not work" description={explanation ?? ""}>
      <div className="flex flex-col gap-2 text-sm">
        <Link className="underline underline-offset-4" href={authRoutes.forgotPassword}>
          Request a new reset link
        </Link>
        <Link className="underline underline-offset-4" href={authRoutes.signIn}>
          Back to sign in
        </Link>
        <Link className="underline underline-offset-4" href={authRoutes.verifyEmail}>
          Send a new confirmation email
        </Link>
      </div>
    </AuthCard>
  );
}
