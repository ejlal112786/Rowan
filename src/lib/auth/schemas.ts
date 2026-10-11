import { z } from "zod";

import { TIMEZONES } from "@/config/timezones";

/**
 * Validation for every value that enters Rowan from an authentication or account form.
 *
 * These schemas are the single source of truth for the shape of that input: the server
 * actions parse with them, the forms use the same rules to render requirements, and the
 * tests assert the rules directly. Nothing here ever echoes the submitted value in a
 * message (docs/SECURITY.md §4).
 */

/** Maximum length accepted by the provider for an email address. */
export const EMAIL_MAX_LENGTH = 254;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { error: "Enter your email address." })
  .max(EMAIL_MAX_LENGTH, { error: "That email address is too long." })
  .pipe(z.email({ error: "Enter a valid email address." }));

/**
 * Minimum password length.
 *
 * Length is the property that actually resists guessing, so the policy is length plus
 * two cheap checks (no leading/trailing spaces, not a famously breached password)
 * rather than character-class rules, which push people towards predictable patterns.
 * The provider's own minimum is lower; Rowan's is enforced before the request is sent.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;

/** A short deny list of passwords that appear at the top of every breach corpus. */
const BREACHED_PASSWORDS = new Set([
  "123456789012",
  "passwordpassword",
  "password1234",
  "qwertyuiop12",
  "letmeinletmein",
  "iloveyouiloveyou",
  "adminadmin12",
  "welcome12345",
  "1234567890123",
  "abcdefghijkl",
]);

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    error: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `Use at most ${PASSWORD_MAX_LENGTH} characters.`,
  })
  .refine((value) => value.trim() === value, {
    error: "Remove leading or trailing spaces.",
  })
  .refine((value) => !BREACHED_PASSWORDS.has(value.toLowerCase()), {
    error: "That password appears in public breach lists. Choose a different one.",
  });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter a display name." })
  .max(80, { error: "Use at most 80 characters." })
  .refine((value) => !/[\u0000-\u001f\u007f]/.test(value), {
    error: "Remove control characters.",
  });

export const timezoneSchema = z
  .string()
  .trim()
  .refine((value) => (TIMEZONES as readonly string[]).includes(value), {
    error: "Choose a time zone from the list.",
  });

export const bioSchema = z.string().trim().max(500, { error: "Use at most 500 characters." });

/** Sign-in: loose on purpose — the provider decides whether the credentials are valid. */
export const signInInputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Enter your password." }).max(PASSWORD_MAX_LENGTH, {
    error: "That password is too long.",
  }),
});

export const signUpInputSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    error: "The passwords do not match.",
    path: ["passwordConfirm"],
  })
  .refine(
    (value) => {
      const localPart = value.email.split("@")[0] ?? "";
      return localPart.length < 3 || !value.password.toLowerCase().includes(localPart);
    },
    { error: "Do not include your email address in your password.", path: ["password"] },
  );

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

export const passwordUpdateSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    error: "The passwords do not match.",
    path: ["passwordConfirm"],
  });

export const profileInputSchema = z.object({
  displayName: z.union([displayNameSchema, z.literal("")]).transform((value) => value || null),
  timezone: z
    .union([timezoneSchema, z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  bio: z.union([bioSchema, z.literal("")]).transform((value) => (value === "" ? null : value)),
});

export const deleteAccountSchema = z.object({
  /**
   * The user must type their own email address. It is compared against the address on
   * the session — never against a form field, which could be tampered with.
   */
  confirmation: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, { error: "Type your email address to confirm." }),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type SignInInput = z.infer<typeof signInInputSchema>;
export type SignUpInput = z.infer<typeof signUpInputSchema>;
export type PasswordUpdateInput = z.infer<typeof passwordUpdateSchema>;
export type ProfileInput = z.infer<typeof profileInputSchema>;

/** Read a form field as a string without trusting its presence. */
export function readFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

/**
 * Turn Zod issues into per-field messages for rendering.
 *
 * Field-level errors let a form point at the input that needs attention; anything
 * without a known field is attached to `_form`.
 */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : "_form";
    fieldErrors[key] ??= issue.message;
  }

  return fieldErrors;
}
