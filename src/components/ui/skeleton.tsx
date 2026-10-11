import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/** Non-interactive placeholder block used while content is loading. */
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}
