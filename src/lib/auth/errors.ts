import { ZERO_WIDTH_PATTERN } from "@/lib/auth/text";

/**
 * Translation of authentication-provider failures into messages a person can act on.
 *
 * Two rules, both enforced by tests:
 *
 * 1. **Never confirm whether an account exists.** Sign-in failures collapse to one
 *    message; password-reset requests always report the same outcome. An attacker
 *    probing for registered addresses learns nothing.
 * 2. **Never surface a provider message verbatim.** Supabase messages are useful
 *    diagnostics, not user copy, and they are attached to `context` for logging only.
 *
 * The provider is asked to confirm an address only after the password was accepted,
 * which is why "confirm your email" is safe to show: it tells a legitimate user what to
 * do next without telling an attacker anything about an address they cannot already
 * authenticate as.
 */

/** Supabase auth error codes Rowan classifies explicitly. */
export const AUTH_ERROR_CODES = {
  invalidCredentials: "invalid_credentials",
  emailNotConfirmed: "email_not_confirmed",
  userAlreadyExists: "user_already_exists",
  weakPassword: "weak_password",
  samePassword: "same_password",
  overRequestRateLimit: "over_request_rate_limit",
  overEmailSendRateLimit: "over_email_send_rate_limit",
  emailExists: "email_exists",
  otpExpired: "otp_expired",
  sessionNotFound: "session_not_found",
  userNotFound: "user_not_found",
  validationFailed: "validation_failed",
} as const;

export type AuthProviderError = {
  message?: string | undefined;
  status?: number | undefined;
  code?: string | undefined;
};

export type AuthFailure = {
  message: string;
  /** Provider code, for server-side logging. Never rendered. */
  providerCode: string | undefined;
  /** HTTP status the provider returned, for server-side logging. */
  providerStatus: number | undefined;
};

const SIGN_IN_FAILURE: AuthFailure = {
  message: "That email address and password combination is not recognised.",
  providerCode: undefined,
  providerStatus: undefined,
};

function failure(message: string, error: AuthProviderError | null): AuthFailure {
  return {
    message,
    providerCode: typeof error?.code === "string" ? error.code : undefined,
    providerStatus: typeof error?.status === "number" ? error.status : undefined,
  };
}

function normalize(value: string | undefined): string {
  return (value ?? "").replace(ZERO_WIDTH_PATTERN, "").toLowerCase();
}

function includesAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

/** Failure for a sign-in attempt. */
export function signInFailure(error: AuthProviderError | null): AuthFailure {
  const code = normalize(error?.code);
  const message = normalize(error?.message);

  if (code === AUTH_ERROR_CODES.emailNotConfirmed || includesAny(message, ["not confirmed"])) {
    return failure(
      "Confirm your email address before signing in. Check your inbox for the link.",
      error,
    );
  }

  if (
    code === AUTH_ERROR_CODES.overRequestRateLimit ||
    code === AUTH_ERROR_CODES.overEmailSendRateLimit ||
    error?.status === 429
  ) {
    return failure("Too many attempts. Wait a moment and try again.", error);
  }

  // Everything else — wrong password, unknown address, malformed request — is one
  // message on purpose.
  return failure(SIGN_IN_FAILURE.message, error);
}

/**
 * Failure for account creation.
 *
 * With email confirmation enabled the provider returns success for an address that
 * already exists (to prevent enumeration); an explicit error here means something else
 * went wrong, and it is still reported without confirming anything.
 */
export function signUpFailure(error: AuthProviderError | null): AuthFailure {
  const code = normalize(error?.code);
  const message = normalize(error?.message);

  if (code === AUTH_ERROR_CODES.weakPassword || includesAny(message, ["password should be"])) {
    return failure("Choose a longer password — the provider rejected that one.", error);
  }

  if (
    code === AUTH_ERROR_CODES.overRequestRateLimit ||
    code === AUTH_ERROR_CODES.overEmailSendRateLimit ||
    error?.status === 429
  ) {
    return failure("Too many attempts. Wait a moment and try again.", error);
  }

  if (code === AUTH_ERROR_CODES.validationFailed || error?.status === 422) {
    return failure("Check the details you entered and try again.", error);
  }

  return failure(
    "We could not create that account. Try again, or sign in if you already have one.",
    error,
  );
}

/** Failure for a password-reset request. Always the same message, by design. */
export function resetRequestFailure(error: AuthProviderError | null): AuthFailure {
  if (
    normalize(error?.code) === AUTH_ERROR_CODES.overRequestRateLimit ||
    normalize(error?.code) === AUTH_ERROR_CODES.overEmailSendRateLimit ||
    error?.status === 429
  ) {
    return failure("Too many requests. Wait a moment and try again.", error);
  }

  return failure("We could not send that email. Try again shortly.", error);
}

/** Failure for setting a new password. */
export function passwordUpdateFailure(error: AuthProviderError | null): AuthFailure {
  const code = normalize(error?.code);

  if (
    code === AUTH_ERROR_CODES.samePassword ||
    normalize(error?.message).includes("different from the old")
  ) {
    return failure("Choose a password you have not used for this account.", error);
  }

  if (
    code === AUTH_ERROR_CODES.weakPassword ||
    normalize(error?.message).includes("password should be")
  ) {
    return failure("Choose a longer password — the provider rejected that one.", error);
  }

  if (code === AUTH_ERROR_CODES.overRequestRateLimit || error?.status === 429) {
    return failure("Too many attempts. Wait a moment and try again.", error);
  }

  return failure("We could not update your password. Sign in again and retry.", error);
}

/** Failure for a profile update that reached the database layer. */
export function profileUpdateFailure(error: AuthProviderError | null): AuthFailure {
  return failure("We could not save your profile. Try again.", error);
}

/** Failure for an outgoing verification email. */
export function resendFailure(error: AuthProviderError | null): AuthFailure {
  if (
    normalize(error?.code) === AUTH_ERROR_CODES.overEmailSendRateLimit ||
    normalize(error?.code) === AUTH_ERROR_CODES.overRequestRateLimit ||
    error?.status === 429
  ) {
    return failure("Too many emails requested. Wait a few minutes and try again.", error);
  }

  return failure("We could not send that email. Try again shortly.", error);
}

/** Failure for a link that could not be verified (expired or already used). */
export function linkVerificationFailure(error: AuthProviderError | null): AuthFailure {
  const code = normalize(error?.code);
  const message = normalize(error?.message);

  if (code === AUTH_ERROR_CODES.otpExpired || includesAny(message, ["expired", "invalid"])) {
    return failure(
      "That link is invalid or has expired. Request a new one and use it within the hour.",
      error,
    );
  }

  return failure("We could not verify that link. Request a new one and try again.", error);
}

/** Failure for account deletion. */
export function accountDeletionFailure(error: AuthProviderError | null): AuthFailure {
  return failure(
    "We could not delete your account. Try again, and contact support if it persists.",
    error,
  );
}
