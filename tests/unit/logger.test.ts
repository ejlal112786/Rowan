import { beforeAll, describe, expect, it, vi } from "vitest";

import { isSensitiveKey, logger, redact } from "@/lib/logger";

/**
 * LOG_LEVEL is set before the first log call in this file so the memoised
 * server environment picks up `error`; the level-filtering assertions below
 * depend on it.
 */
beforeAll(() => {
  process.env.LOG_LEVEL = "error";
});

describe("isSensitiveKey", () => {
  it.each(["apiKey", "api_key", "x-api-key", "Authorization", "PASSWORD", "session_id"])(
    "flags %s as sensitive",
    (key) => {
      expect(isSensitiveKey(key)).toBe(true);
    },
  );

  it.each(["model", "providerId", "latencyMs", "requestId"])("allows %s", (key) => {
    expect(isSensitiveKey(key)).toBe(false);
  });
});

describe("redact", () => {
  it("replaces sensitive nested values", () => {
    const redacted = redact({
      provider: "openrouter",
      config: { apiKey: "sk-live-secret", region: "eu" },
    });

    expect(redacted).toEqual({
      provider: "openrouter",
      config: { apiKey: "[redacted]", region: "eu" },
    });
  });

  it("redacts an entire subtree when the container key is sensitive", () => {
    // Fail-safe direction: `credentials` is a sensitive container, so nothing
    // inside it is inspected or emitted.
    expect(redact({ credentials: { apiKey: "sk-live-secret", region: "eu" } })).toEqual({
      credentials: "[redacted]",
    });
  });

  it("redacts prompt and document payloads", () => {
    expect(redact({ prompt: "summarise this", document: { text: "confidential" } })).toEqual({
      prompt: "[redacted]",
      document: "[redacted]",
    });
  });

  it("truncates long strings", () => {
    const redacted = redact({ note: "x".repeat(600) }) as { note: string };
    expect(redacted.note.length).toBeLessThan(600);
    expect(redacted.note.endsWith("…")).toBe(true);
  });

  it("summarises errors without their payloads", () => {
    const error = new Error("upstream 401");
    expect(redact({ error })).toEqual({
      error: { name: "Error", message: "upstream 401" },
    });
  });

  it("handles circular references", () => {
    type Node = { name: string; self?: Node };
    const node: Node = { name: "root" };
    node.self = node;

    expect(redact(node)).toEqual({ name: "root", self: "[circular]" });
  });

  it("bounds recursion depth", () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: 1 } } } } } } } };
    expect(JSON.stringify(redact(deep))).toContain("[truncated]");
  });

  it("bounds array length", () => {
    const redacted = redact(Array.from({ length: 120 }, (_, index) => index)) as unknown[];
    expect(redacted).toHaveLength(51);
    expect(redacted.at(-1)).toBe("[truncated]");
  });
});

describe("logger", () => {
  it("respects the configured minimum level", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.debug("debug line");
    logger.info("info line");
    logger.warn("warn line");
    logger.error("error line");

    expect(info).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("emits structured JSON with redacted context", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logger.error("provider call failed", {
      provider: "gemini",
      apiKey: "sk-live-0123456789",
      request: { prompt: "leak me", modelId: "gemini-2.5-flash" },
    });

    expect(error).toHaveBeenCalledTimes(1);
    const line = error.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");

    const parsed = JSON.parse(String(line)) as {
      level: string;
      message: string;
      context: { apiKey: string; provider: string; request: { prompt: string; modelId: string } };
    };

    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("provider call failed");
    expect(parsed.context.provider).toBe("gemini");
    expect(parsed.context.apiKey).toBe("[redacted]");
    expect(parsed.context.request.prompt).toBe("[redacted]");
    expect(parsed.context.request.modelId).toBe("gemini-2.5-flash");
    expect(String(line)).not.toContain("sk-live-0123456789");
    expect(String(line)).not.toContain("leak me");
  });
});
