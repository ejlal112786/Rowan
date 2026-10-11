"use client";

import { LogOut } from "lucide-react";
import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { signOutEverywhereAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";

/**
 * End every session, everywhere.
 *
 * This is the control that matters when a device is lost or a password is suspected
 * compromised: it revokes every session Rowan knows about and asks the provider to end all
 * refresh tokens, so nothing can be refreshed back into existence.
 */
export function SignOutEverywhereForm() {
  const [state, formAction] = useActionState(signOutEverywhereAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Signing out…">
          <LogOut aria-hidden="true" />
          Sign out of all devices
        </SubmitButton>
      </div>
    </form>
  );
}
