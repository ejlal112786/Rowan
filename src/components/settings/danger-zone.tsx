"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { deleteAccountAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";

/**
 * Account deletion.
 *
 * Deletion is irreversible, so it is guarded by a typed confirmation of the address shown
 * on screen — the value is compared against the session's own email on the server, never
 * against a hidden field. The copy states exactly what is removed and what happens to open
 * sessions, because "delete account" means different things in different products.
 */
export function DangerZone({ email }: { email: string }) {
  const [state, formAction] = useActionState(deleteAccountAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="border-destructive/40 bg-destructive/5 flex items-start gap-2 rounded-md border px-3 py-2">
        <TriangleAlert aria-hidden="true" className="text-destructive mt-0.5 size-4 shrink-0" />
        <p className="text-sm leading-relaxed">
          Deleting your account removes your profile, your sessions, and everything else stored
          against it. This cannot be undone, and you will be signed out of every device.
        </p>
      </div>

      <FormMessage state={state} />

      <FormField
        name="confirmation"
        label={`Type ${email} to confirm`}
        type="email"
        autoComplete="off"
        required
        placeholder={email}
        hint="This must match the address on the account."
        error={state.fieldErrors?.confirmation}
      />

      <div>
        <SubmitButton variant="destructive" pendingLabel="Deleting…">
          Delete account
        </SubmitButton>
      </div>
    </form>
  );
}
