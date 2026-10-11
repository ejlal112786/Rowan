import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("drops falsy values", () => {
    expect(cn("px-2", false, undefined, null, "", "text-sm")).toBe("px-2 text-sm");
  });

  it("lets later Tailwind utilities win over conflicting earlier ones", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("bg-muted", "bg-card")).toBe("bg-card");
  });

  it("keeps non-conflicting utilities", () => {
    expect(cn("flex items-center", "gap-2")).toBe("flex items-center gap-2");
  });

  it("resolves conditional variants", () => {
    const isActive = true;
    expect(cn("text-sm", isActive && "font-medium")).toBe("text-sm font-medium");
  });
});
