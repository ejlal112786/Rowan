import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Standard page container: consistent max width, padding, and vertical rhythm. */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Page heading block. Renders a single <h1> per page so landmark structure
 * stays consistent for screen readers and the document outline remains valid.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-border flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
