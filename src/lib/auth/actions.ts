"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { withUserContext } from "@/lib/db/query";
import { revokeOtherSessions, revokeSession } from "@/lib/data/sessions";
import { updateProfile } from "@/lib/data/profiles";
import { deleteAccount } from "@/lib/auth/account";
import {
  passwordUpdateFailure,
  resendFailure,
  resetRequestFailure,
  signInFailure,
  signUpFailure,
} from "@/lib/auth/errors";
import { formError, formSuccess, type FormState } from "@/lib/auth/form-state";
import { absoluteUrlFor } from "@/lib/auth/origin";
import { safeRedirectPath, signInPathFor } from "@/lib/auth/redirects";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";
import {
  deleteAccountSchema,
  passwordResetRequestSchema,
  passwordUpdateSchema,
  profileInputSchema,
  readFormValue,
  resendVerificationSchema,
  signInInputSchema,
  signUpInputSchema,
  toFieldErrors,
} from "@/lib/auth/schemas";
import { createSupabaseServerClient } from "@/lib/auth/server-client";
import { getCurrentUser, getSessionOutcome } from "@/lib/auth/session";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Authentication and account server actions.
 *
 * Every action follows the same shape:
 *
 *   parse (Zod, field-level errors) → authenticate (server-side) → perform →
 *   `redirect()` or return a `FormState`
 *
 * `redirect()` throws by design, so it is always called *after* the `try`/`catch` block —
 * a navigation must never be swallowed as an error.
 *
 * Two invariants are enforced here rather than in the UI, because the UI is not a
 * security boundary:
 *   - the acting user id comes from the verified session, never from a form field;
 *   - failures are reported with `src/lib/auth/errors.ts` messages, which never confirm
 *     whether an email address has an account.
 */

/**
 * Provision the account and record the session once the provider has accepted credentials.
 *
 * It deliberately runs the same code path as any authenticated request
 * (`getSessionOutcome`), so there is exactly one place in Rowan that creates account rows
 * — no second implementation to keep in step.
 */
async function bootstrapSession(userId: string, event: string): Promise<void> {
  try {
    await getSessionOutcome();
  } catch (error) {
    // The credentials were accepted, so the user is signed in; bookkeeping failing must
    // not turn a successful sign-in into an error screen.
    logger.error(`Session bookkeeping failed after ${event}`, {
      userId,
      ...(error instanceof AppError ? { code: error.code } : {}),
    });
  }
}

/** Sign in with an email address and password. */
export async function signInAction(previous: FormState, formData: FormData): Promise<FormState> {
  void previous;

  const parsed = signInInputSchema.safeParse({
    email: readFormValue(formData, "email"),
    password: readFormValue(formData, "password"),
  });

  if (!parsed.success) {
    return formError("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const provider = await createSupabaseServerClient();
  const { data, error } = await provider.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error !== null || data.user === null) {
    const failure = signInFailure(error);

    logger.warn("Sign-in rejected", {
      providerCode: failure.providerCode,
      providerStatus: failure.providerStatus,
    });

    return formError(failure.message);
  }

  await bootstrapSession(data.user.id, "sign-in");

  redirect(safeRedirectPath(readFormValue(formData, "next"), defaultAuthenticatedPath));
}

/**
 * Create an account.
 *
 * With email confirmation enabled the provider deliberately reports success for an
 * address that already exists, so the outcome is the same either way: a page that says
 * "check your inbox".
 */
export async function signUpAction(previous: FormState, formData: FormData): Promise<FormState> {
  void previous;

  const parsed = signUpInputSchema.safeParse({
    email: readFormValue(formData, "email"),
    password: readFormValue(formData, "password"),
    passwordConfirm: readFormValue(formData, "passwordConfirm"),
  });

  if (!parsed.success) {
    return formError("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const provider = await createSupabaseServerClient();
  const emailRedirectTo = await absoluteUrlFor(
    `${authRoutes.callback}?next=${encodeURIComponent(defaultAuthenticatedPath)}`,
  );

  const { data, error } = await provider.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo },
  });

  if (error !== null) {
    const failure = signUpFailure(error);

    logger.warn("Sign-up rejected", {
      providerCode: failure.providerCode,
      providerStatus: failure.providerStatus,
    });

    return formError(failure.message);
  }

  // When the project does not require confirmation, the provider returns a session and
  // the new account is already signed in.
  if (data.session !== null && data.user !== null) {
    await bootstrapSession(data.user.id, "sign-up");

    redirect(defaultAuthenticatedPath);
  }

  redirect(authRoutes.verifyEmail);
}

/** Ask for a new verification email. Always reports the same outcome. */
export async function resendVerificationAction(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  void previous;

  const parsed = resendVerificationSchema.safeParse({
    email: readFormValue(formData, "email"),
  });

  if (!parsed.success) {
    return formError("Enter the address you registered with.", toFieldErrors(parsed.error));
  }

  const provider = await createSupabaseServerClient();
  const emailRedirectTo = await absoluteUrlFor(
    `${authRoutes.callback}?next=${encodeURIComponent(defaultAuthenticatedPath)}`,
  );

  const { error } = await provider.auth.resend({
    type: "signup",
    email: parsed.data.email,
    options: { emailRedirectTo },
  });

  if (error !== null) {
    const failure = resendFailure(error);

    logger.warn("Verification resend rejected", {
      providerCode: failure.providerCode,
      providerStatus: failure.providerStatus,
    });

    if (failure.providerStatus === 429) {
      return formError(failure.message);
    }
  }

  return formSuccess("If that address has an unverified account, a new link is on its way.");
}

/** Request a password-reset email. Always reports the same outcome. */
export async function requestPasswordResetAction(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  void previous;

  const parsed = passwordResetRequestSchema.safeParse({
    email: readFormValue(formData, "email"),
  });

  if (!parsed.success) {
    return formError("Enter the email address for your account.", toFieldErrors(parsed.error));
  }

  const provider = await createSupabaseServerClient();
  const redirectTo = await absoluteUrlFor(
    `${authRoutes.callback}?next=${encodeURIComponent(authRoutes.resetPassword)}&type=recovery`,
  );

  const { error } = await provider.auth.resetPasswordForEmail(parsed.data.email, { redirectTo });

  if (error !== null) {
    const failure = resetRequestFailure(error);

    logger.warn("Password-reset request rejected", {
      providerCode: failure.providerCode,
      providerStatus: failure.providerStatus,
    });

    if (failure.providerStatus === 429) {
      return formError(failure.message);
    }
  }

  return formSuccess(
    "If that address has an account, a reset link is on its way. The link can be used once, within an hour.",
  );
}

/**
 * Set a new password for the signed-in (or recovery) session.
 *
 * Any other session is revoked afterwards, in Rowan and at the provider: a password
 * change is supposed to end access for anything that was signed in with the old one.
 */
export async function updatePasswordAction(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  void previous;

  const user = await getCurrentUser();

  if (user === null) {
    redirect(`${authRoutes.forgotPassword}?reason=link-expired`);
  }

  const parsed = passwordUpdateSchema.safeParse({
    password: readFormValue(formData, "password"),
    passwordConfirm: readFormValue(formData, "passwordConfirm"),
  });

  if (!parsed.success) {
    return formError("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  const provider = await createSupabaseServerClient();
  const { error } = await provider.auth.updateUser({ password: parsed.data.password });

  if (error !== null) {
    const failure = passwordUpdateFailure(error);

    logger.warn("Password update rejected", {
      userId: user.id,
      providerCode: failure.providerCode,
      providerStatus: failure.providerStatus,
    });

    return formError(failure.message);
  }

  try {
    await withUserContext(user.id, async (context) => {
      await revokeOtherSessions(context, user.sessionId, "password-changed");
    });

    await provider.auth.signOut({ scope: "others" });
  } catch (error) {
    logger.error("Could not revoke other sessions after a password change", {
      userId: user.id,
      ...(error instanceof AppError ? { code: error.code } : {}),
    });
  }

  logger.info("Password updated", { userId: user.id });
  revalidatePath(authRoutes.resetPassword);
  revalidatePath("/settings/security");

  return formSuccess("Your password has been updated. Other devices were signed out.");
}

/** Save the editable profile fields. */
export async function updateProfileAction(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  void previous;

  const user = await getCurrentUser();

  if (user === null) {
    redirect(signInPathFor("/settings"));
  }

  const parsed = profileInputSchema.safeParse({
    displayName: readFormValue(formData, "displayName"),
    timezone: readFormValue(formData, "timezone"),
    bio: readFormValue(formData, "bio"),
  });

  if (!parsed.success) {
    return formError("Check the highlighted fields.", toFieldErrors(parsed.error));
  }

  try {
    await withUserContext(user.id, async (context) => {
      await updateProfile(context, parsed.data);
    });
  } catch (error) {
    const message = error instanceof AppError ? error.message : "We could not save your profile.";

    logger.error("Profile update failed", {
      userId: user.id,
      ...(error instanceof AppError ? { code: error.code } : {}),
    });

    return formError(message);
  }

  revalidatePath("/settings");
  revalidatePath("/settings/security");

  return formSuccess("Profile saved.");
}

/**
 * Revoke one of the current user's sessions.
 *
 * The session id arrives from a form field, so it is treated as untrusted input: the update
 * is scoped to the authenticated user (and runs as the RLS-enforced runtime role), which
 * means a session id belonging to someone else affects no rows. Revoking the session in use
 * signs the caller out rather than leaving them on a page whose session no longer exists.
 */
export async function revokeSessionAction(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  void previous;

  const user = await getCurrentUser();

  if (user === null) {
    redirect(signInPathFor("/settings/security"));
  }

  const sessionId = readFormValue(formData, "sessionId");

  if (sessionId === "") {
    return formError("That session could not be identified.", {
      sessionId: "Missing session identifier.",
    });
  }

  try {
    const { revoked } = await withUserContext(user.id, async (context) => {
      return revokeSession(context, sessionId, "revoked-by-user");
    });

    if (!revoked) {
      return formError("That session is not active any more.", {
        sessionId: "Already revoked or expired.",
      });
    }
  } catch (error) {
    logger.error("Session revocation failed", {
      userId: user.id,
      ...(error instanceof AppError ? { code: error.code } : {}),
    });

    return formError("We could not revoke that session. Try again.");
  }

  if (user.sessionId !== null && sessionId === user.sessionId) {
    try {
      const provider = await createSupabaseServerClient();
      await provider.auth.signOut({ scope: "local" });
    } catch {
      // The session is already revoked in Rowan; clearing the cookie is best-effort.
    }

    redirect(`${authRoutes.signIn}?signedOut=1`);
  }

  revalidatePath("/settings/security");

  return formSuccess("That session has been revoked.");
}

/**
 * Sign out of every device.
 *
 * Revokes every session Rowan knows about *and* asks the provider to end all refresh
 * tokens, so a session that was never recorded here cannot be refreshed back to life.
 */
export async function signOutEverywhereAction(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  void previous;
  void formData;

  const outcome = await getSessionOutcome();

  if (outcome.status === "authenticated") {
    const { user } = outcome;

    try {
      await withUserContext(user.id, async (context) => {
        await revokeOtherSessions(context, null, "signed-out-everywhere");
      });

      const provider = await createSupabaseServerClient();
      await provider.auth.signOut({ scope: "global" });

      logger.info("Signed out everywhere", { userId: user.id });
    } catch (error) {
      logger.warn("Sign-out-everywhere bookkeeping failed", {
        userId: user.id,
        ...(error instanceof AppError ? { code: error.code } : {}),
      });
    }
  }

  redirect(`${authRoutes.signIn}?signedOut=1`);
}

/**
 * Delete the account and everything it owns.
 *
 * The typed confirmation is compared against the session's own address, so a tampered
 * form cannot delete the wrong account — and there is no form field that identifies the
 * account in the first place.
 */
export async function deleteAccountAction(
  previous: FormState,
  formData: FormData,
): Promise<FormState> {
  void previous;

  const user = await getCurrentUser();

  if (user === null) {
    redirect(signInPathFor("/settings/security"));
  }

  const parsed = deleteAccountSchema.safeParse({
    confirmation: readFormValue(formData, "confirmation"),
  });

  if (!parsed.success) {
    return formError("Type your email address to confirm.", toFieldErrors(parsed.error));
  }

  if (parsed.data.confirmation !== user.email.toLowerCase()) {
    return formError("That does not match the email address on this account.", {
      confirmation: "Enter the address shown above, exactly.",
    });
  }

  const result = await deleteAccount({ id: user.id, sessionId: user.sessionId });

  if (!result.deleted) {
    return formError(result.message);
  }

  try {
    const provider = await createSupabaseServerClient();
    await provider.auth.signOut({ scope: "local" });
  } catch {
    // The provider user no longer exists; clearing the cookie is best-effort.
  }

  redirect(`${authRoutes.signIn}?deleted=1`);
}
