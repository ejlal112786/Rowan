import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { newChatAction, primaryNav } from "@/config/navigation";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

/** Map a route path onto the App Router file that must implement it. */
function pageFileFor(href: string): string {
  const segments = href.split("/").filter((segment) => segment.length > 0);
  return path.join(repositoryRoot, "src", "app", ...segments, "page.tsx");
}

describe("primaryNav", () => {
  it("points every entry at an absolute path", () => {
    for (const item of primaryNav) {
      expect(item.href.startsWith("/")).toBe(true);
    }
  });

  it("contains no duplicate destinations", () => {
    const hrefs = primaryNav.map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("labels every entry and explains what it is for", () => {
    for (const item of primaryNav) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("has a real route on disk for every entry", () => {
    for (const item of primaryNav) {
      const pageFile = pageFileFor(item.href);
      expect(existsSync(pageFile), `missing page for ${item.href} at ${pageFile}`).toBe(true);
    }
  });

  it("marks unimplemented destinations as planned", () => {
    const planned = primaryNav.filter((item) => item.availability === "planned").map((n) => n.href);

    // Settings became a real destination in Phase 2 (account, profile, sessions); the
    // conversation and comparison surfaces are still placeholders.
    expect(planned).toEqual(["/conversations", "/compare"]);
  });
});

describe("newChatAction", () => {
  it("is scheduled for a future phase and is not presented as available", () => {
    expect(newChatAction.label).toBe("New chat");
    expect(newChatAction.phase).toBeGreaterThan(1);
  });
});
