/**
 * AI providers Rowan will support, and the phase in which each adapter ships.
 *
 * This file is static product configuration only. It contains no credentials
 * and performs no network calls: provider connectivity is implemented in
 * Phase 3 behind the adapter interface described in docs/ARCHITECTURE.md.
 */

export type ProviderId = "openrouter" | "gemini" | "deepseek" | "mistral";

export type PlannedProvider = {
  id: ProviderId;
  name: string;
  /** Neutral, factual description of what the provider offers. */
  summary: string;
  /** Phase in which the server-side adapter and key storage land. */
  integrationPhase: number;
};

export const plannedProviders: readonly PlannedProvider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    summary: "One key for models from many vendors.",
    integrationPhase: 3,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    summary: "Google's Gemini models, including long-context variants.",
    integrationPhase: 3,
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    summary: "DeepSeek chat and reasoning models.",
    integrationPhase: 3,
  },
  {
    id: "mistral",
    name: "Mistral",
    summary: "Mistral's open-weight and commercial models.",
    integrationPhase: 3,
  },
] as const;
