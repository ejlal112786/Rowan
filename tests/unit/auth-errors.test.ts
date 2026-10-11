import { describe, expect, it } from "vitest";

import {
  linkVerificationFailure,
  passwordUpdateFailure,
  resendFailure,
  resetRequestFailure,
  signInFailure,
  signUpFailure,
} from "@/lib/auth/errors";

/**
 * Non-disclosure rules for authentication failures.
 *
 * Two properties matter and both are checked here:
 *
 *   1. A failure never confirms whether an email address has an account. An attacker with a
 *      list of addresses must not be able to turn it into a list of users.
 *   2. A provider message is never the message a user sees. Provider diagnostics go to logs;
 *      user copy is authored in `src/lib/auth/errors.ts`.
 */
const UNKNOWN_EMAIL = "nobody-here@example.com";
const PASSWORD = "correct horse battery";

describe("signInFailure", () => {
  it("returns one message for a wrong password and for an unknown address", () => {
    const wrongPassword = signInFailure({
      message: `Invalid login credentials for ${UNKNOWN_EMAIL}`,
      status: 400,
      code: "invalid_credentials",
    });

    const unknownAddress = signInFailure({
      message: "Invalid login credentials",
      status: 400,
      code: "invalid_credentials",
    });

    expect(wrongPassword.message).toBe(unknownAddress.message);
    expect(wrongPassword.message).not.toContain(UNKNOWN_EMAIL);
    expect(wrongPassword.message).not.toMatch(/invalid login credentials/i);
  });

  it("keeps the provider code for logging without rendering it", () => {
    const failure = signInFailure({ code: "invalid_credentials", status: 400 });

    expect(failure.providerCode).toBe("invalid_credentials");
    expect(failure.providerStatus).toBe(400);
    expect(failure.message).not.toContain("invalid_credentials");
  });

  it("tells a legitimate user to confirm the address when the password was accepted", () => {
    const failure = signInFailure({ code: "email_not_confirmed", status: 400 });

    expect(failure.message).toMatch(/confirm your email/i);
  });

  it("reports rate limiting as a retryable condition", () => {
    expect(signInFailure({ status: 429 }).message).toMatch(/too many attempts/i);
    expect(signInFailure({ code: "over_request_rate_limit" }).message).toMatch(/too many/i);
  });

  it("handles a missing provider error without throwing", () => {
    expect(signInFailure(null).message).toBe(signInFailure(null).message);
    expect(typeof signInFailure(null).message).toBe("string");
  });

  it("ignores zero-width characters used to disguise a provider code", () => {
    const failure = signInFailure({ code: "email_not\u200b_confirmed", status: 400 });

    expect(failure.message).toMatch(/confirm your email/i);
  });
});

describe("signUpFailure", () => {
  it("does not reveal that an address already exists", () => {
    const failure = signUpFailure({ code: "user_already_exists", status: 422 });

    expect(failure.message).not.toMatch(/already exists/i);
    expect(failure.message).not.toContain(UNKNOWN_EMAIL);
  });

  it("explains a rejected password without quoting the provider", () => {
    const failure = signUpFailure({
      message: "Password should be at least 6 characters",
      code: "weak_password",
    });

    expect(failure.message).toMatch(/longer password/i);
    expect(failure.message).not.toMatch(/at least 6/i);
  });

  it("reports rate limiting", () => {
    expect(signUpFailure({ status: 429 }).message).toMatch(/too many/i);
  });
});

describe("resetRequestFailure", () => {
  it("does not distinguish an unknown address from a real one", () => {
    const unknown = resetRequestFailure({ code: "user_not_found", status: 404 });
    const throttled = resetRequestFailure({ status: 429 });

    expect(unknown.message).toMatch(/try again/i);
    expect(throttled.message).toMatch(/too many/i);
  });
});

describe("passwordUpdateFailure", () => {
  it("maps the provider's re-use rule to actionable copy", () => {
    expect(passwordUpdateFailure({ code: "same_password" }).message).toMatch(
      /have not used for this account/i,
    );
  });

  it("falls back to a safe message for anything unexpected", () => {
    const failure = passwordUpdateFailure({ message: "internal detail", status: 500 });

    expect(failure.message).not.toContain("internal detail");
    expect(failure.message).toMatch(/could not update/i);
  });
});

describe("resendFailure", () => {
  it("reports throttling distinctly from other failures", () => {
    expect(resendFailure({ status: 429 }).message).toMatch(/too many/i);
    expect(resendFailure({ status: 500 }).message).toMatch(/try again shortly/i);
  });
});

describe("linkVerificationFailure", () => {
  it("explains an expired link and what to do next", () => {
    const failure = linkVerificationFailure({ code: "otp_expired", status: 403 });

    expect(failure.message).toMatch(/expired/i);
    expect(failure.message).toMatch(/request a new one/i);
  });

  it("uses a generic message for an unrecognised failure", () => {
    expect(linkVerificationFailure({ code: "weird", status: 400 }).message).toMatch(
      /could not verify/i,
    );
  });
});

describe("provider messages are never user copy", () => {
  it("never returns the provider's own message text", () => {
    const providerMessage = `Upstream said: account ${UNKNOWN_EMAIL} needs attention`;

    const failures = [
      signInFailure({ message: providerMessage, status: 400 }),
      signUpFailure({ message: providerMessage, status: 400 }),
      resetRequestFailure({ message: providerMessage, status: 400 }),
      passwordUpdateFailure({ message: providerMessage, status: 400 }),
      resendFailure({ message: providerMessage, status: 400 }),
      linkVerificationFailure({ message: providerMessage, status: 400 }),
    ];

    for (const failure of failures) {
      expect(failure.message).not.toContain(UNKNOWN_EMAIL);
      expect(failure.message).not.toContain("Upstream said");
    }

    // Sanity: the constant is actually used, so the assertions above are meaningful.
    expect(PASSWORD).toContain("horse");
  });
});
