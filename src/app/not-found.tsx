import { FileQuestion } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { PageContainer } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <PageContainer className="items-start justify-center py-20">
      <div className="flex flex-col items-start gap-3">
        <span className="border-border bg-muted flex size-10 items-center justify-center rounded-full border">
          <FileQuestion aria-hidden="true" className="text-muted-foreground size-4" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          The page you requested does not exist. Conversations, the Model Arena, and Settings are
          reachable from the sidebar once their phases ship.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/">Back to workspace</Link>
        </Button>
      </div>
    </PageContainer>
  );
}
