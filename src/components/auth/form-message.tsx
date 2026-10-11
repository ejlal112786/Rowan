"use client";

import { CircleAlert, CircleCheck } from "lucide-react";

import type { FormState } from "@/lib/auth/form-state";
import { cn } from "@/lib/utils";

/**
 * Form-level outcome message.
 *
 * Rendered only when a submission produced something to say. Errors use `role="alert"`
 * (interrupting) and successes `role="status"` (polite), which is the accessible way to
 * distinguish "this failed" from "this worked" without relying on colour.
 */
export function FormMessage({ state, className }: { state: FormState; className?: string }) {
  if (state.message === undefined || state.status === "idle") {
    return null;
  }

  const isError = state.status === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      data-slot="form-message"
      data-status={state.status}
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm leading-relaxed",
        isError
          ? "border-destructive/40 text-destructive bg-destructive/5"
          : "border-border bg-muted/40 text-foreground",
        className,
      )}
    >
      {isError ? (
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      ) : (
        <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{state.message}</span>
    </p>
  );
}
