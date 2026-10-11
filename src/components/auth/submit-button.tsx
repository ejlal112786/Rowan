"use client";

import { useFormStatus } from "react-dom";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Submit button that reports its own pending state.
 *
 * `useFormStatus` is what makes this honest: while the action is in flight the button is
 * genuinely disabled and marked `aria-busy`, so a keyboard user cannot queue a second
 * submission and a screen-reader user is told that work is happening.
 */

export type SubmitButtonProps = Omit<ButtonProps, "type" | "asChild"> & {
  /** Label shown while the action is pending. Falls back to the normal label. */
  pendingLabel?: string;
};

export function SubmitButton({ children, pendingLabel, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending} {...props}>
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
