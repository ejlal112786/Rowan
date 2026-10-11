"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { MobileNavigation } from "@/components/app-shell/mobile-navigation";
import { BrandLink } from "@/components/brand/brand-link";
import { ThemeToggle } from "@/components/ui/theme-toggle";

/**
 * Responsive application shell.
 *
 * Desktop: a persistent sidebar plus the main content column.
 * Mobile: a compact header with a navigation drawer (Radix Dialog supplies the
 * focus trap, Escape handling, and modal semantics).
 *
 * The sidebar element is authored once by a server component (`layout.tsx`) and
 * passed in, so this client component only owns layout, not navigation content.
 */
export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main content
      </a>

      <header className="border-sidebar-border bg-sidebar sticky top-0 z-40 flex h-14 items-center gap-1 border-b px-2 md:hidden">
        {/* Keyed by route so the drawer state resets on navigation. */}
        <MobileNavigation key={pathname} />
        <BrandLink />
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
        </div>
      </header>

      <aside className="border-sidebar-border bg-sidebar hidden w-64 shrink-0 border-r md:sticky md:top-0 md:flex md:h-svh lg:w-72">
        {sidebar}
      </aside>

      <main id="main-content" className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  );
}
