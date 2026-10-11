import type { z } from "zod";

import { AppError, type ErrorCode } from "@/lib/errors";

/**
 * Runtime-validation helpers built on Zod.
 *
 * Rule: every value that crosses a trust boundary (HTTP body, query string,
 * Route Handler output, third-party AI provider payload, database row) is
 * parsed with a schema before use. See docs/SECURITY.md.
 */

/**
 * Convert Zod issues into `path: message` strings.
 * Issue messages must never contain the rejected value — schemas defined in
 * this codebase only ever describe the expected shape.
 */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

export type ParseOptions = {
  /** Human-readable name of the thing being parsed, used in error messages. */
  label: string;
  /** Error code to attach to the thrown `AppError`. */
  code?: ErrorCode;
};

/**
 * Parse `input` with `schema`, throwing a typed `AppError` when it does not
 * match. The thrown message lists the offending paths, which makes
 * misconfiguration diagnosable without echoing any value.
 */
export function parseOrThrow<Output>(
  schema: z.ZodType<Output>,
  input: unknown,
  options: ParseOptions,
): Output {
  const result = schema.safeParse(input);

  if (!result.success) {
    const details = formatZodIssues(result.error).join("; ");
    throw new AppError(`${options.label} is invalid — ${details}`, {
      code: options.code ?? "VALIDATION_FAILED",
      context: { issueCount: result.error.issues.length },
    });
  }

  return result.data;
}

export type SafeParseResult<Output> = { ok: true; data: Output } | { ok: false; issues: string[] };

/**
 * Non-throwing variant of `parseOrThrow`, for flows that render validation
 * feedback (for example form errors) instead of failing hard.
 */
export function safeParse<Output>(
  schema: z.ZodType<Output>,
  input: unknown,
): SafeParseResult<Output> {
  const result = schema.safeParse(input);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  return { ok: false, issues: formatZodIssues(result.error) };
}
