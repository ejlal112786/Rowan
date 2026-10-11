"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { primaryNav } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * Primary navigation list.
 *
 * The active route is announced with `aria-current="page"`; planned
 * destinations are labelled so the entry point is never mistaken for a
 * finished feature.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="flex flex-col gap-0.5">
      {primaryNav.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            {...(onNavigate ? { onClick: onNavigate } : {})}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <item.icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.availability === "planned" ? (
              <Badge variant="muted" className="ml-auto px-2 text-[0.6875rem]">
                Planned
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
