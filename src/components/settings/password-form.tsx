"use client";

import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { updatePasswordAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";

/**
 * Change the password from account settings.
 *
 * The consequence of the change is stated on the form: every other session ends. A user
 * who is not told that will assume the change did nothing when another device asks them to
 * sign in again.
 */
export function PasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />

      <PasswordField
        name="password"
        label="New password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
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

      <p className="text-muted-foreground text-xs leading-relaxed">
        Saving signs out every other device. This one stays signed in.
      </p>

      <div>
        <SubmitButton pendingLabel="Updating…">Update password</SubmitButton>
      </div>
    </form>
  );
}
