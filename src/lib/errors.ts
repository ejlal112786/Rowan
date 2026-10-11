/**
 * Application error primitives.
 *
 * Conventions:
 * - `AppError` messages are considered safe to show to an end user. Never put
 *   secrets, provider payloads, or internal identifiers in them.
 * - Anything that is *not* an `AppError` is treated as an unexpected internal
 *   failure and is reported to users as a generic message (`toPublicError`).
 * - Raw causes are attached for server-side logging only and are never returned
 *   by an HTTP response.
 *
 * This module is intentionally framework-agnostic: it is safe to import from
 * both server and client modules.
 */

export const ERROR_CODES = [
  "ENV_INVALID",
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "PROVIDER_ERROR",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const HTTP_STATUS_BY_CODE: Record<ErrorCode, number> = {
  ENV_INVALID: 500,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  PROVIDER_ERROR: 502,
  INTERNAL: 500,
};

export type AppErrorOptions = {
  code?: ErrorCode;
  /** Overrides the HTTP status derived from `code`. */
  httpStatus?: number;
  /** Server-side diagnostics. Never serialized to a client response. */
  context?: Record<string, unknown>;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly context: Record<string, unknown> | undefined;

  constructor(message: string, options: AppErrorOptions = {}) {
    const code: ErrorCode = options.code ?? "INTERNAL";
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.httpStatus = options.httpStatus ?? HTTP_STATUS_BY_CODE[code];
    this.context = options.context;
  }
}

/** Narrow an unknown thrown value to `AppError` without trusting its shape. */
export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Coerce an unknown thrown value into an `AppError`.
 * Non-`AppError` values are wrapped so their internals never reach a user.
 */
export function toAppError(value: unknown, fallbackMessage: string): AppError {
  if (isAppError(value)) {
    return value;
  }

  if (value instanceof Error) {
    return new AppError(fallbackMessage, { code: "INTERNAL", cause: value });
  }

  return new AppError(fallbackMessage, { code: "INTERNAL", cause: value });
}

export type PublicError = {
  code: ErrorCode;
  status: number;
  message: string;
};

/** Generic message used for any failure we do not explicitly classify. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Reduce any thrown value to the minimal payload that is safe to return to a
 * client: a stable code, an HTTP status, and a message that never contains
 * internal details.
 */
export function toPublicError(value: unknown): PublicError {
  if (isAppError(value)) {
    return { code: value.code, status: value.httpStatus, message: value.message };
  }

  return { code: "INTERNAL", status: 500, message: GENERIC_ERROR_MESSAGE };
}
