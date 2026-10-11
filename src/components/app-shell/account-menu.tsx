"use client";

import { CircleUser, KeyRound, LogIn, UserPlus } from "lucide-react";

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

/**
 * Account area.
 *
 * It is visually prepared for authentication but explicitly anonymous: there is
 * no signed-in user, no session, and no email address. The disabled menu items
 * document what Phase 2 adds; they perform no action and cannot be activated.
 */
export function AccountMenu() {
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
          <Badge variant="muted" className="ml-auto px-2 text-[0.6875rem]">
            Preview
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <div className="text-muted-foreground px-2 pb-2 text-xs leading-relaxed">
          Rowan has no accounts yet. Authentication and user profiles are implemented in Phase 2.
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <LogIn aria-hidden="true" />
          <span>Sign in</span>
          <span className="text-muted-foreground ml-auto text-xs">Phase 2</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <UserPlus aria-hidden="true" />
          <span>Create account</span>
          <span className="text-muted-foreground ml-auto text-xs">Phase 2</span>
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
