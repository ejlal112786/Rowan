/**
 * Static product metadata for Rowan.
 *
 * This module is imported by both server and client components, so it must
 * never read `process.env` or contain secrets.
 */

export const appConfig = {
  name: "Rowan",
  category: "Multi-provider AI assistant",
  tagline: "One workspace for every model you use.",
  description:
    "Rowan is a multi-provider AI assistant. Connect your own API keys for OpenRouter, Google Gemini, DeepSeek, and Mistral, and work with every model through one consistent interface.",
  /** Current delivery phase. Keep in sync with docs/ROADMAP.md. */
  phase: {
    current: 1,
    total: 10,
    title: "Architecture and production foundation",
    next: {
      number: 2,
      title: "Database, authentication, and user accounts",
    },
  },
} as const;

export type AppConfig = typeof appConfig;
