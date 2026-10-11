/**
 * Form state shared by every authentication and account action.
 *
 * Server actions return this shape and the forms render it. Keeping it out of the
 * `"use server"` modules is required (those may export only async functions) and it keeps
 * the client and server components agreeing on one contract.
 */

export type FormState = {
  status: "idle" | "error" | "success";
  /** Form-level message: the result of the submission as a whole. */
  message?: string;
  /** Per-field messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function formError(message: string, fieldErrors?: Record<string, string>): FormState {
  return fieldErrors === undefined
    ? { status: "error", message }
    : { status: "error", message, fieldErrors };
}

export function formSuccess(message: string): FormState {
  return { status: "success", message };
}
