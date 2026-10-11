import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError } from "@/lib/errors";
import { formatZodIssues, parseOrThrow, safeParse } from "@/lib/validation";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

describe("formatZodIssues", () => {
  it("renders nested paths and a root marker", () => {
    const result = z.object({ author: z.object({ name: z.string() }) }).safeParse({
      author: { name: 42 },
    });

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(formatZodIssues(result.error)).toEqual([
      "author.name: Invalid input: expected string, received number",
    ]);
  });
});

describe("parseOrThrow", () => {
  it("returns the parsed value for valid input", () => {
    const parsed = parseOrThrow(
      messageSchema,
      { role: "user", content: "hello" },
      { label: "Message" },
    );

    expect(parsed).toEqual({ role: "user", content: "hello" });
  });

  it("throws a VALIDATION_FAILED AppError that names the offending field", () => {
    expect(() =>
      parseOrThrow(
        messageSchema,
        { role: "system", content: "hi" },
        {
          label: "Message",
        },
      ),
    ).toThrowError(AppError);

    try {
      parseOrThrow(messageSchema, { role: "system", content: "" }, { label: "Message" });
      expect.unreachable("parseOrThrow should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe("VALIDATION_FAILED");
      expect(appError.message).toContain("Message is invalid");
      expect(appError.message).toContain("role");
      expect(appError.message).toContain("content");
    }
  });

  it("honours a custom error code", () => {
    const result = safeParse(z.string(), 42);
    expect(result.ok).toBe(false);

    try {
      parseOrThrow(z.string(), 42, { label: "Environment", code: "ENV_INVALID" });
      expect.unreachable("parseOrThrow should have thrown");
    } catch (error) {
      expect((error as AppError).code).toBe("ENV_INVALID");
    }
  });

  it("never echoes rejected values in the error message", () => {
    const secret = "sk-live-0123456789abcdef";

    try {
      parseOrThrow(
        z.object({ apiKey: z.string().min(64) }),
        { apiKey: secret },
        { label: "Credentials" },
      );
      expect.unreachable("parseOrThrow should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toContain("apiKey");
      expect((error as AppError).message).not.toContain(secret);
      expect((error as AppError).message).not.toContain("sk-live");
    }
  });
});

describe("safeParse", () => {
  it("returns ok with data for valid input", () => {
    expect(safeParse(z.string(), "value")).toEqual({ ok: true, data: "value" });
  });

  it("returns structured issues without throwing", () => {
    const result = safeParse(z.object({ id: z.uuid() }), { id: "not-a-uuid" });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain("id:");
  });
});
