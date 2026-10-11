import Link from "next/link";

import { RowanMark } from "@/components/brand/rowan-mark";
import { appConfig } from "@/config/app";
import { cn } from "@/lib/utils";

/** Rowan wordmark that links back to the workspace home. */
export function BrandLink({
  className,
  withTagline = false,
}: {
  className?: string;
  withTagline?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn(
        "hover:bg-sidebar-accent flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors",
        className,
      )}
    >
      <RowanMark className="text-foreground size-6" />
      <span className="flex min-w-0 flex-col">
        <span className="text-sm leading-tight font-semibold tracking-tight">{appConfig.name}</span>
        {withTagline ? (
          <span className="text-muted-foreground truncate text-xs leading-tight">
            {appConfig.category}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
