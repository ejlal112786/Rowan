"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { signUpAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { authRoutes } from "@/lib/auth/routes";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";

/**
 * Account-creation form.
 *
 * The password rule is stated before submission rather than revealed as a rejection, and
 * the rule itself is explained: length is what resists guessing, so the hint says so
 * instead of listing symbol requirements.
 */
export function SignUpForm() {
  const [state, formAction] = useActionState(signUpAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />

      <FormField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        hint="We send a confirmation link to this address."
        error={state.fieldErrors?.email}
      />

      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        hint={`At least ${PASSWORD_MIN_LENGTH} characters, and not your email address. Length matters more than symbols.`}
        error={state.fieldErrors?.password}
        maxLength={PASSWORD_MAX_LENGTH}
      />

      <PasswordField
        name="passwordConfirm"
        label="Confirm password"
        autoComplete="new-password"
        error={state.fieldErrors?.passwordConfirm}
        maxLength={PASSWORD_MAX_LENGTH}
      />

      <SubmitButton pendingLabel="Creating account…" className="w-full">
        Create account
      </SubmitButton>

      <p className="text-sm">
        Already registered?{" "}
        <Link className="underline-offset-4 hover:underline" href={authRoutes.signIn}>
          Sign in
        </Link>
      </p>
    </form>
  );
}
