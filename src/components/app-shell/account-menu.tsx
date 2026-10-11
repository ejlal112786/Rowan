"use client";

import { CircleUser, KeyRound, LogIn, LogOut, Settings, UserPlus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authRoutes, defaultAuthenticatedPath } from "@/lib/auth/routes";

/**
 * Account area.
 *
 * Two honest states, and nothing in between:
 *
 *   - **Signed out:** the only actions are the ones that exist — sign in, create an
 *     account. Provider keys stay disabled and labelled with the phase that delivers them,
 *     because Rowan stores no provider key yet.
 *   - **Signed in:** the identity shown comes from the server session, never from the
 *     browser, and the menu links to surfaces that are actually implemented.
 *
 * Sign-out is a link to the sign-out route handler rather than a menu item that submits a
 * form: the handler revokes the session, ends the provider session, clears the cookies, and
 * redirects, which is exactly what a menu selection should do. It also keeps the control
 * usable from a keyboard without fighting the menu's focus management.
 */
export type AccountSummary = {
  email: string;
  displayName: string | null;
};

export function AccountMenu({ user }: { user: AccountSummary | null }) {
  if (user === null) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto w-full justify-start gap-2.5 px-2.5 py-2 font-normal"
          >
            <CircleUser aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
            <span className="truncate text-sm">Not signed in</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <div className="text-muted-foreground px-2 pb-2 text-xs leading-relaxed">
            Sign in to keep your profile and sessions. Rowan stores nothing about you until you
            create an account.
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={authRoutes.signIn}>
              <LogIn aria-hidden="true" />
              <span>Sign in</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={authRoutes.signUp}>
              <UserPlus aria-hidden="true" />
              <span>Create account</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <KeyRound aria-hidden="true" />
            <span>Provider keys</span>
            <span className="text-muted-foreground ml-auto text-xs">Phase 3</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const label = user.displayName ?? user.email.split("@")[0] ?? user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto w-full justify-start gap-2.5 px-2.5 py-2 font-normal"
        >
          <CircleUser aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 truncate text-sm">{label}</span>
          <Badge variant="secondary" className="ml-auto px-2 text-[0.6875rem]">
            Signed in
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span>{label}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={defaultAuthenticatedPath}>
            <Settings aria-hidden="true" />
            <span>Account settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <KeyRound aria-hidden="true" />
          <span>Provider keys</span>
          <span className="text-muted-foreground ml-auto text-xs">Phase 3</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href={`${authRoutes.signOutHandler}?next=${encodeURIComponent(authRoutes.signIn)}`}
            prefetch={false}
          >
            <LogOut aria-hidden="true" />
            <span>Sign out</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
