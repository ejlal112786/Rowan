"use client";

import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { resendVerificationAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";

/**
 * Request another confirmation email.
 *
 * The address is typed rather than prefilled from the URL: keeping an email address out
 * of the query string keeps it out of browser history, referrer headers, and server logs.
 */
export function ResendVerificationForm() {
  const [state, formAction] = useActionState(resendVerificationAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />

      <FormField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        hint="The address you registered with."
        error={state.fieldErrors?.email}
      />

      <SubmitButton pendingLabel="Sending…" variant="outline" className="w-full">
        Send a new link
      </SubmitButton>
    </form>
  );
}
