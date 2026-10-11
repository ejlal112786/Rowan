import { AccountMenu, type AccountSummary } from "@/components/app-shell/account-menu";
import { NewChatButton } from "@/components/app-shell/new-chat-button";
import { SidebarNav } from "@/components/app-shell/sidebar-nav";
import { BrandLink } from "@/components/brand/brand-link";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { appConfig } from "@/config/app";

/**
 * Persistent desktop sidebar: brand, primary action, navigation, and the
 * account/theme footer. Rendered on the server (it receives the authenticated
 * account from the session) and composed into the client shell, so only the
 * interactive fragments ship as client components.
 */
export function Sidebar({ user }: { user: AccountSummary | null }) {
  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto p-3">
      <div className="flex items-center justify-between gap-1">
        <BrandLink withTagline />
      </div>

      <NewChatButton />

      <SidebarNav />

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="border-sidebar-border bg-background/60 flex items-center gap-1 rounded-lg border p-1">
          <div className="min-w-0 flex-1">
            <AccountMenu user={user} />
          </div>
          <ThemeToggle />
        </div>
        <p className="text-muted-foreground px-1 text-xs leading-relaxed">
          {appConfig.name} is at Phase {appConfig.phase.current} of {appConfig.phase.total}:{" "}
          {appConfig.phase.title.toLowerCase()}.
        </p>
      </div>
    </div>
  );
}
