import "server-only";

import { getServerEnv } from "@/lib/env/server";

/**
 * Minimal structured server logger with redaction-by-default.
 *
 * Rules encoded here (see docs/SECURITY.md):
 * - Never log API keys, tokens, cookies, sessions, credentials, or secrets.
 * - Never log prompt text, message arrays, document contents, or attachments.
 * - Nested objects are walked with a bounded depth so a single log call cannot
 *   dump an unbounded payload.
 *
 * Replace with an OpenTelemetry exporter in Phase 9; the call sites and the
 * redaction boundary are designed to stay the same.
 */

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
} as const;

export type LogLevel = keyof typeof LEVEL_PRIORITY;

export type LogContext = Record<string, unknown>;

const REDACTED = "[redacted]";
const TRUNCATED = "[truncated]";
const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 50;

/**
 * Key markers that mark a value as sensitive. Keys are normalised to lowercase
 * alphanumerics before matching, so `apiKey`, `api_key`, and `x-api-key` all
 * collide with the `apikey` marker.
 */
const SENSITIVE_KEY_MARKERS = [
  "apikey",
  "authorization",
  "bearer",
  "cookie",
  "credential",
  "password",
  "privatekey",
  "secret",
  "sessionid",
  "token",
  "prompt",
  "messages",
  "document",
  "attachment",
  "filecontent",
] as const;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  return SENSITIVE_KEY_MARKERS.some(
    (marker) => normalized === marker || normalized.includes(marker),
  );
}

/**
 * Recursively copy `value`, replacing sensitive values with `[redacted]` and
 * bounding size. Cyclic references are reported instead of throwing.
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > MAX_DEPTH) {
    return TRUNCATED;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "function" || typeof value === "symbol") {
    return `[${typeof value}]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message:
        value.message.length > MAX_STRING_LENGTH
          ? `${value.message.slice(0, MAX_STRING_LENGTH)}…`
          : value.message,
      ...(value.cause === undefined ? {} : { cause: redact(value.cause, depth + 1, seen) }),
    };
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, depth + 1, seen));
    return value.length > MAX_ARRAY_ITEMS ? [...items, TRUNCATED] : items;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }
    seen.add(value);

    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    const redacted: Record<string, unknown> = {};

    for (const [key, nestedValue] of entries) {
      redacted[key] = isSensitiveKey(key) ? REDACTED : redact(nestedValue, depth + 1, seen);
    }

    return redacted;
  }

  return `[${typeof value}]`;
}

function shouldLog(level: LogLevel): boolean {
  const minimumLevel = getServerEnv().LOG_LEVEL;
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minimumLevel];
}

function write(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    level,
    message,
    ...(context === undefined ? {} : { context: redact(context) }),
  };

  const line = JSON.stringify(payload);

  switch (level) {
    case "debug":
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export const logger = {
  debug: (message: string, context?: LogContext): void => write("debug", message, context),
  info: (message: string, context?: LogContext): void => write("info", message, context),
  warn: (message: string, context?: LogContext): void => write("warn", message, context),
  error: (message: string, context?: LogContext): void => write("error", message, context),
};
