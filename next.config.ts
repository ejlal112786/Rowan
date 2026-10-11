import type { NextConfig } from "next";

/**
 * Rowan — Next.js configuration.
 *
 * Kept deliberately minimal and environment-agnostic: no hardcoded domains or
 * deployment URLs. Anything environment-specific is supplied through validated
 * environment variables (see `src/lib/env/server.ts` and `.env.example`).
 *
 * Security headers are applied here so they hold for every route, including
 * static assets, without relying on middleware.
 */
const isProductionBuild = process.env.NODE_ENV === "production";

const securityHeaders = [
  // Clickjacking protection. Production deployments refuse to be framed at all;
  // development and review tooling legitimately renders the dev server inside a
  // cross-origin frame, so this header is scoped to production builds. A
  // Content-Security-Policy with `frame-ancestors` is added in Phase 9.
  ...(isProductionBuild ? [{ key: "X-Frame-Options", value: "DENY" }] : []),
  // Never let browsers guess a content type we did not intend (MIME sniffing).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Send the origin (not the full path/query) to cross-origin destinations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features Rowan does not use yet.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typescript: {
    // Never allow a production build to succeed with type errors.
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
