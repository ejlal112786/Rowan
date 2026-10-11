"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { updatePasswordAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";

/**
 * Set a new password.
 *
 * Reached from a recovery link (which establishes a short-lived session) or from account
 * security while signed in. On success every other session is revoked, so the screen says
 * so rather than leaving the user to discover it on another device.
 */
export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />

      <PasswordField
        name="password"
        label="New password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. Signing in elsewhere with the old password stops working.`}
        error={state.fieldErrors?.password}
        maxLength={PASSWORD_MAX_LENGTH}
      />

      <PasswordField
        name="passwordConfirm"
        label="Confirm new password"
        autoComplete="new-password"
        error={state.fieldErrors?.passwordConfirm}
        maxLength={PASSWORD_MAX_LENGTH}
      />

      <SubmitButton pendingLabel="Updating…" className="w-full">
        Update password
      </SubmitButton>

      <p className="text-sm">
        <Link className="underline-offset-4 hover:underline" href={defaultAuthenticatedPath}>
          Continue to settings
        </Link>
        {" · "}
        <Link className="underline-offset-4 hover:underline" href={authRoutes.signIn}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
