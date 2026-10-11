"use client";

import { Menu } from "lucide-react";
import { useState } from "react";

import { AccountMenu, type AccountSummary } from "@/components/app-shell/account-menu";
import { NewChatButton } from "@/components/app-shell/new-chat-button";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { BrandLink } from "@/components/brand/brand-link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/**
 * Mobile navigation drawer.
 *
 * The open state lives here rather than in `AppShell` so the parent can reset it
 * by re-mounting this component (keyed by pathname) instead of synchronising
 * state inside an effect. Selecting a destination also closes the drawer, so
 * focus never stays trapped behind the navigation.
 */
export function MobileNavigation({ user }: { user: AccountSummary | null }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open navigation">
          <Menu aria-hidden="true" className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetContent aria-describedby={undefined} className="gap-4 p-3">
        <SheetTitle className="sr-only">Rowan navigation</SheetTitle>
        <BrandLink className="mt-8" withTagline />
        <NewChatButton />
        <SidebarNav onNavigate={() => setOpen(false)} />

        <div className="border-sidebar-border mt-auto border-t pt-3">
          <AccountMenu user={user} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
