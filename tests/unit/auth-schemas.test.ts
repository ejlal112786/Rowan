import { describe, expect, it } from "vitest";

import {
  deleteAccountSchema,
  emailSchema,
  passwordSchema,
  profileInputSchema,
  readFormValue,
  signInInputSchema,
  signUpInputSchema,
  toFieldErrors,
} from "@/lib/auth/schemas";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/schemas";

/**
 * Credential and profile validation.
 *
 * The password policy is deliberately *not* a character-class rule set: length plus a
 * breach-list check is what NIST 800-63B recommends, and it is what these tests pin down.
 * The point of a test suite here is that relaxing the policy later is a deliberate act.
 */
const VALID_PASSWORD = "correct horse battery";

describe("emailSchema", () => {
  it("normalises case and surrounding whitespace", () => {
    const parsed = emailSchema.parse("  Person@Example.COM ");

    expect(parsed).toBe("person@example.com");
  });

  it("rejects malformed addresses without echoing them", () => {
    const result = emailSchema.safeParse("not-an-address");

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(JSON.stringify(result.error.issues)).not.toContain("not-an-address");
  });

  it("rejects addresses that are too long", () => {
    expect(emailSchema.safeParse(`${"a".repeat(250)}@example.com`).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts a long passphrase", () => {
    expect(passwordSchema.safeParse(VALID_PASSWORD).success).toBe(true);
  });

  it("enforces the minimum length", () => {
    const result = passwordSchema.safeParse("short");

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues[0]?.message).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it("enforces the maximum length the provider accepts", () => {
    expect(passwordSchema.safeParse("a".repeat(73)).success).toBe(false);
  });

  it("rejects leading or trailing whitespace", () => {
    expect(passwordSchema.safeParse(` ${VALID_PASSWORD}`).success).toBe(false);
    expect(passwordSchema.safeParse(`${VALID_PASSWORD} `).success).toBe(false);
  });

  it("rejects passwords from public breach lists", () => {
    const result = passwordSchema.safeParse("passwordpassword");

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues[0]?.message).toMatch(/breach/i);
  });
});

describe("signUpInputSchema", () => {
  it("accepts matching passwords", () => {
    const result = signUpInputSchema.safeParse({
      email: "person@example.com",
      password: VALID_PASSWORD,
      passwordConfirm: VALID_PASSWORD,
    });

    expect(result.success).toBe(true);
  });

  it("reports a mismatch on the confirmation field", () => {
    const result = signUpInputSchema.safeParse({
      email: "person@example.com",
      password: VALID_PASSWORD,
      passwordConfirm: "something else entirely",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error).passwordConfirm).toMatch(/do not match/i);
  });

  it("refuses a password containing the email local part", () => {
    const result = signUpInputSchema.safeParse({
      email: "rowanuser@example.com",
      password: "rowanuser-2026-secret",
      passwordConfirm: "rowanuser-2026-secret",
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(toFieldErrors(result.error).password).toMatch(/email address/i);
  });

  it("allows short local parts that would be too common to check", () => {
    const result = signUpInputSchema.safeParse({
      email: "ab@example.com",
      password: "ab-is-in-this-password",
      passwordConfirm: "ab-is-in-this-password",
    });

    expect(result.success).toBe(true);
  });
});

describe("signInInputSchema", () => {
  it("does not apply the password policy to an existing credential", () => {
    // A user whose password predates the current policy must still be able to sign in.
    const result = signInInputSchema.safeParse({ email: "person@example.com", password: "old" });

    expect(result.success).toBe(true);
  });

  it("requires both fields", () => {
    const result = signInInputSchema.safeParse({ email: "", password: "" });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(Object.keys(toFieldErrors(result.error)).sort()).toEqual(["email", "password"]);
  });
});

describe("profileInputSchema", () => {
  it("maps empty strings to null instead of storing them", () => {
    expect(profileInputSchema.parse({ displayName: "", timezone: "", bio: "  " })).toEqual({
      displayName: null,
      timezone: null,
      bio: null,
    });
  });

  it("trims a display name", () => {
    expect(
      profileInputSchema.parse({
        displayName: "  Person  ",
        timezone: "Europe/London",
        bio: "Hello",
      }),
    ).toEqual({ displayName: "Person", timezone: "Europe/London", bio: "Hello" });
  });

  it("rejects a time zone that is not offered", () => {
    const result = profileInputSchema.safeParse({
      displayName: "",
      timezone: "Mars/Olympus_Mons",
      bio: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a bio over the column limit", () => {
    const result = profileInputSchema.safeParse({
      displayName: "",
      timezone: "",
      bio: "x".repeat(501),
    });

    expect(result.success).toBe(false);
  });

  it("rejects control characters in a display name", () => {
    const result = profileInputSchema.safeParse({
      displayName: "Person\u0000",
      timezone: "",
      bio: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("deleteAccountSchema", () => {
  it("normalises the confirmation before it is compared", () => {
    expect(deleteAccountSchema.parse({ confirmation: "  Person@Example.com " })).toEqual({
      confirmation: "person@example.com",
    });
  });

  it("requires a value", () => {
    expect(deleteAccountSchema.safeParse({ confirmation: "" }).success).toBe(false);
  });
});

describe("readFormValue", () => {
  it("returns an empty string for a missing field", () => {
    expect(readFormValue(new FormData(), "email")).toBe("");
  });

  it("returns an empty string for a non-string field", () => {
    const formData = new FormData();
    formData.set("upload", new File(["x"], "x.txt"));

    expect(readFormValue(formData, "upload")).toBe("");
  });

  it("returns the submitted value", () => {
    const formData = new FormData();
    formData.set("email", "person@example.com");

    expect(readFormValue(formData, "email")).toBe("person@example.com");
  });
});
