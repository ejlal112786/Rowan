"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { requestPasswordResetAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { authRoutes } from "@/lib/auth/routes";

/**
 * Password-reset request form.
 *
 * The success state deliberately does not confirm that an account exists — it reports
 * what will happen *if* one does. That is the whole point of this screen: it must not be
 * usable to test whether an address is registered.
 */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />

      <FormField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />

      <SubmitButton pendingLabel="Sending…" className="w-full">
        Send reset link
      </SubmitButton>

      <p className="text-sm">
        <Link className="underline-offset-4 hover:underline" href={authRoutes.signIn}>
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
