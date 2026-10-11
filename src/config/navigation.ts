import { MessagesSquare, Scale, Settings, SquarePen, type LucideIcon } from "lucide-react";

/**
 * Primary navigation for the application shell.
 *
 * `availability` describes the real state of each destination in this phase:
 * - `"available"` — the route exists and renders real (empty-state) content.
 * - `"planned"` — the route exists to explain the planned feature; it does not
 *   perform the underlying action yet.
 *
 * No entry may claim a capability that is not implemented.
 */
export type NavAvailability = "available" | "planned";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Short description used for accessibility hints and page subtitles. */
  description: string;
  availability: NavAvailability;
};

export const primaryNav: readonly NavItem[] = [
  {
    label: "Chat",
    href: "/",
    icon: MessagesSquare,
    description: "Start and continue conversations with your connected models.",
    availability: "available",
  },
  {
    label: "Conversations",
    href: "/conversations",
    icon: MessagesSquare,
    description: "Search and revisit your saved conversations.",
    availability: "planned",
  },
  {
    label: "Model Arena",
    href: "/compare",
    icon: Scale,
    description: "Compare responses from multiple providers side by side.",
    availability: "planned",
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Manage your account, profile, password, and sessions.",
    availability: "available",
  },
] as const;

/** The primary action of the shell. Implemented in Phase 4. */
export const newChatAction = {
  label: "New chat",
  icon: SquarePen,
  phase: 4,
} as const;
