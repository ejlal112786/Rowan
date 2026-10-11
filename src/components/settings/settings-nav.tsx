"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Sub-navigation for the account surface.
 *
 * `aria-current="page"` marks the active destination for assistive technology; the visual
 * state is derived from the same comparison, so the two can never disagree.
 */
const SETTINGS_NAV = [
  { label: "Profile", href: "/settings", exact: true },
  { label: "Security", href: "/settings/security", exact: false },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account settings" className="flex gap-1 overflow-x-auto">
      {SETTINGS_NAV.map((item) => {
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
              isActive
                ? "bg-secondary text-secondary-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
