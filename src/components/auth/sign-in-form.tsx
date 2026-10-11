"use client";

import Link from "next/link";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { signInAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";

/**
 * Sign-in form.
 *
 * `next` travels as a hidden field and is re-validated on the server
 * (`safeRedirectPath`): a value that arrives from the browser is never trusted to be a
 * path on this origin just because a page put it there.
 */
export function SignInForm({
  next = defaultAuthenticatedPath,
  notice,
}: {
  next?: string;
  notice?: string;
}) {
  const [state, formAction] = useActionState(signInAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      {notice === undefined ? null : <FormMessage state={{ status: "success", message: notice }} />}

      <FormMessage state={state} />

      <FormField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        error={state.fieldErrors?.email}
      />

      <PasswordField
        name="password"
        label="Password"
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />

      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>

      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link className="underline-offset-4 hover:underline" href={authRoutes.forgotPassword}>
          Forgot your password?
        </Link>
        <Link className="underline-offset-4 hover:underline" href={authRoutes.signUp}>
          Create an account
        </Link>
      </div>
    </form>
  );
}
