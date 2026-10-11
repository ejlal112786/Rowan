import { describe, expect, it } from "vitest";

import { plannedProviders } from "@/config/providers";

describe("plannedProviders", () => {
  it("lists the four providers Rowan commits to in this phase", () => {
    expect(plannedProviders.map((provider) => provider.id)).toEqual([
      "openrouter",
      "gemini",
      "deepseek",
      "mistral",
    ]);
  });

  it("schedules every adapter for the provider-integration phase", () => {
    for (const provider of plannedProviders) {
      expect(provider.integrationPhase).toBe(3);
    }
  });

  it("describes providers without claiming a working connection", () => {
    for (const provider of plannedProviders) {
      expect(provider.summary.length).toBeGreaterThan(0);
      expect(provider.summary.toLowerCase()).not.toContain("connected");
    }
  });
});
