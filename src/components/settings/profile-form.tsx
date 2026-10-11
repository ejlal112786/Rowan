"use client";

import { useActionState } from "react";

import { FormField } from "@/components/auth/form-field";
import { FormMessage } from "@/components/auth/form-message";
import { SubmitButton } from "@/components/auth/submit-button";
import { updateProfileAction } from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";
import { TIMEZONES } from "@/config/timezones";

/**
 * Profile editor.
 *
 * Only the fields a user owns are here. Identity facts (email address, verification state)
 * are read-only in the same surface: changing an email address is an authentication event
 * with an email round-trip, so it belongs with the account-security controls rather than a
 * text input that saves silently.
 */
export function ProfileForm({
  displayName,
  timezone,
  bio,
}: {
  displayName: string | null;
  timezone: string | null;
  bio: string | null;
}) {
  const [state, formAction] = useActionState(updateProfileAction, initialFormState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormMessage state={state} />

      <FormField
        name="displayName"
        label="Display name"
        autoComplete="nickname"
        defaultValue={displayName ?? ""}
        placeholder="How Rowan addresses you"
        maxLength={80}
        error={state.fieldErrors?.displayName}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className="text-sm font-medium">
          Time zone
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={timezone ?? ""}
          aria-invalid={state.fieldErrors?.timezone === undefined ? undefined : true}
          aria-describedby={
            state.fieldErrors?.timezone === undefined ? undefined : "timezone-error"
          }
          className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        >
          <option value="">Not set</option>
          {TIMEZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Used by later phases to show times in your zone. Nothing is scheduled yet.
        </p>
        {state.fieldErrors?.timezone === undefined ? null : (
          <p id="timezone-error" role="alert" className="text-destructive text-xs">
            {state.fieldErrors.timezone}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium">
          About
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          defaultValue={bio ?? ""}
          maxLength={500}
          aria-invalid={state.fieldErrors?.bio === undefined ? undefined : true}
          aria-describedby={state.fieldErrors?.bio === undefined ? undefined : "bio-error"}
          className="border-input bg-background focus-visible:ring-ring w-full rounded-md border px-3 py-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-none"
        />
        <p className="text-muted-foreground text-xs leading-relaxed">
          Optional. At most 500 characters, visible only to you.
        </p>
        {state.fieldErrors?.bio === undefined ? null : (
          <p id="bio-error" role="alert" className="text-destructive text-xs">
            {state.fieldErrors.bio}
          </p>
        )}
      </div>

      <div>
        <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
      </div>
    </form>
  );
}
