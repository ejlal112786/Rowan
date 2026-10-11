"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { PageContainer } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { toPublicError } from "@/lib/errors";

/**
 * Route-level error boundary.
 *
 * Only the sanitised public error (code, status, safe message) is rendered.
 * The digest is shown so a failure can be correlated with server logs; the raw
 * error object and stack are never displayed to the user.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const publicError = toPublicError(error);

  useEffect(() => {
    // Client-side diagnostics only in development; production relies on the
    // digest being correlated with server-side logs.
    if (process.env.NODE_ENV === "development") {
      console.error("[rowan] rendered error boundary", error);
    }
  }, [error]);

  return (
    <PageContainer className="items-start justify-center py-20">
      <div className="flex flex-col items-start gap-3">
        <span className="border-border bg-muted flex size-10 items-center justify-center rounded-full border">
          <TriangleAlert aria-hidden="true" className="text-muted-foreground size-4" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          {publicError.message}
        </p>
        <p className="text-muted-foreground text-xs">
          Error code: <span className="font-mono">{publicError.code}</span>
          {error.digest ? (
            <>
              {" · digest: "}
              <span className="font-mono">{error.digest}</span>
            </>
          ) : null}
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => reset()}>
          Try again
        </Button>
      </div>
    </PageContainer>
  );
}
