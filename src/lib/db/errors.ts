import { AppError, type ErrorCode } from "@/lib/errors";

/**
 * Translation of PostgreSQL failures into application errors.
 *
 * Two rules drive this module:
 *
 * 1. **A policy violation is never a success.** Row-level security rejections
 *    (`42501`, and the `row-level security` message raised for policy violations)
 *    become `FORBIDDEN`, so a bug in a query's ownership filter fails closed and is
 *    visible to the caller instead of silently returning partial data.
 * 2. **Driver messages never reach users.** The original message is attached as
 *    `context` for server-side logging only; the `AppError` message is authored here.
 */

/** PostgreSQL SQLSTATE codes Rowan classifies explicitly. */
export const PG_ERROR_CODES = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  notNullViolation: "23502",
  checkViolation: "23514",
  insufficientPrivilege: "42501",
  undefinedTable: "42P01",
  serializationFailure: "40001",
  queryCanceled: "57014",
  invalidTextRepresentation: "22P02",
} as const;

type ErrorRule = {
  /** SQLSTATE value, or a substring that must appear in the driver message. */
  sqlState?: string;
  messageIncludes?: string;
  code: ErrorCode;
  message: string;
};

const RULES: readonly ErrorRule[] = [
  {
    // Raised by PostgreSQL when a row fails a `with check` policy — for example an
    // insert that claims another user's id.
    messageIncludes: "row-level security policy",
    code: "FORBIDDEN",
    message: "You do not have access to that record.",
  },
  {
    sqlState: PG_ERROR_CODES.insufficientPrivilege,
    code: "FORBIDDEN",
    message: "You do not have access to that record.",
  },
  {
    sqlState: PG_ERROR_CODES.uniqueViolation,
    code: "CONFLICT",
    message: "That value is already in use.",
  },
  {
    sqlState: PG_ERROR_CODES.foreignKeyViolation,
    code: "VALIDATION_FAILED",
    message: "A referenced record does not exist.",
  },
  {
    sqlState: PG_ERROR_CODES.notNullViolation,
    code: "VALIDATION_FAILED",
    message: "A required value is missing.",
  },
  {
    sqlState: PG_ERROR_CODES.checkViolation,
    code: "VALIDATION_FAILED",
    message: "A value does not meet the constraints for that field.",
  },
  {
    sqlState: PG_ERROR_CODES.invalidTextRepresentation,
    code: "VALIDATION_FAILED",
    message: "A value has the wrong format.",
  },
  {
    sqlState: PG_ERROR_CODES.serializationFailure,
    code: "CONFLICT",
    message: "The request conflicted with another change. Try again.",
  },
  {
    sqlState: PG_ERROR_CODES.queryCanceled,
    code: "INTERNAL",
    message: "The database operation took too long and was cancelled.",
  },
  {
    sqlState: PG_ERROR_CODES.undefinedTable,
    code: "INTERNAL",
    message: "The database schema is not ready.",
  },
];

type DriverErrorShape = {
  code?: unknown;
  message?: unknown;
  constraint?: unknown;
  severity?: unknown;
};

function readDriverError(error: unknown): DriverErrorShape | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  return error as DriverErrorShape;
}

/**
 * Classify a thrown database failure.
 *
 * Anything unrecognised becomes `INTERNAL` with a generic message, so an unexpected
 * driver error can never be mistaken for "empty result" by calling code.
 */
export function toDatabaseAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  const driver = readDriverError(error);
  const sqlState = typeof driver?.code === "string" ? driver.code : undefined;
  const driverMessage = typeof driver?.message === "string" ? driver.message : "";

  const rule = RULES.find(
    (candidate) =>
      (candidate.sqlState !== undefined && candidate.sqlState === sqlState) ||
      (candidate.messageIncludes !== undefined &&
        driverMessage.toLowerCase().includes(candidate.messageIncludes.toLowerCase())),
  );

  if (rule) {
    return new AppError(rule.message, {
      code: rule.code,
      context: {
        sqlState,
        constraint: typeof driver?.constraint === "string" ? driver.constraint : undefined,
      },
      cause: error,
    });
  }

  return new AppError("The database operation failed.", {
    code: "INTERNAL",
    context: { sqlState, driverMessage },
    cause: error,
  });
}
