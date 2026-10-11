import "server-only";

import { headers } from "next/headers";

import { getPublicEnv } from "@/lib/env/public";
import { AppError } from "@/lib/errors";

/**
 * Absolute origin used to build the links Rowan emails to users.
 *
 * The value must not be attacker-controlled: if the `Host` header decided where a
 * confirmation link points, anyone able to send a request could make Rowan email a link
 * to their own domain. The order below prefers values that the deployment controls:
 *
 *   1. `NEXT_PUBLIC_APP_URL` — the documented production setting (README).
 *   2. `VERCEL_URL` — injected by the platform, not by the caller.
 *   3. The request's own headers, **development only**, where the only host is
 *      `localhost` and the convenience matters.
 *
 * In production, with neither variable set, this throws: refusing to send a link is
 * better than sending one to a host nobody configured.
 */

const HOST_PATTERN = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/;

export async function resolveRequestOrigin(): Promise<string> {
  const configured = getPublicEnv().NEXT_PUBLIC_APP_URL;

  if (configured !== undefined) {
    return new URL(configured).origin;
  }

  const vercelUrl = process.env.VERCEL_URL;

  if (vercelUrl !== undefined && vercelUrl.trim() !== "" && HOST_PATTERN.test(vercelUrl.trim())) {
    return `https://${vercelUrl.trim()}`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new AppError(
      "NEXT_PUBLIC_APP_URL must be set in production so email links point at this deployment.",
      { code: "ENV_INVALID", context: { variable: "NEXT_PUBLIC_APP_URL" } },
    );
  }

  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!HOST_PATTERN.test(host) || (protocol !== "http" && protocol !== "https")) {
    return "http://localhost:3000";
  }

  return `${protocol}://${host}`;
}

/** Absolute URL for an in-app path, for use in redirects handed to the provider. */
export async function absoluteUrlFor(path: string): Promise<string> {
  return new URL(path, await resolveRequestOrigin()).toString();
}
