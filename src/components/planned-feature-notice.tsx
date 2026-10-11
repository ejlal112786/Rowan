import { Clock } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Consistent, unambiguous statement that a capability does not exist yet.
 *
 * Every placeholder surface in the shell uses this component so the interface
 * never implies that an unimplemented feature is available.
 */
export function PlannedFeatureNotice({
  phase,
  title,
  children,
  className,
}: {
  /** Delivery phase in which the capability is scheduled (see docs/ROADMAP.md). */
  phase: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="planned-feature-notice"
      className={cn(
        "border-border bg-muted/40 flex gap-3 rounded-lg border border-dashed p-4",
        className,
      )}
    >
      <Clock aria-hidden="true" className="text-muted-foreground mt-0.5 size-4 shrink-0" />
      <div className="flex flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span>{title}</span>
          <Badge variant="outline">Planned · Phase {phase}</Badge>
        </p>
        <p className="text-muted-foreground text-sm leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
