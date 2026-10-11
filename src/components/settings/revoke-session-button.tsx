"use client";

import { ShieldOff } from "lucide-react";
import { useActionState } from "react";

import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { revokeSessionAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";

/**
 * Per-session revoke control.
 *
 * A client component so the button can show its own pending state and the row can display
 * the outcome of *that* revocation. The session id travels as a hidden field and is
 * re-validated server-side against the authenticated user: a tampered value revokes nothing,
 * because the update is scoped to the owner.
 */
export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const [state, formAction] = useActionState(revokeSessionAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 sm:items-end">
      <input type="hidden" name="sessionId" value={sessionId} />
      <SubmitButton variant="outline" size="sm" pendingLabel="Revoking…">
        <ShieldOff aria-hidden="true" />
        Revoke
      </SubmitButton>
      <FormMessage state={state} className="text-xs" />
    </form>
  );
}
