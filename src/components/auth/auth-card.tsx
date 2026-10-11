import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

/**
 * Frame shared by every authentication page: one heading, one explanation, one form.
 *
 * The security note is not decoration — it tells the user what the form does and does
 * not do with what they type, which is the honest version of a trust badge.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        {/*
          Rendered directly rather than through `CardTitle` (which is an h3) so each
          auth page has exactly one h1, matching the page-shell convention.
        */}
        <h1 className="text-lg leading-none font-semibold tracking-tight">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {children}
        <p className="border-border text-muted-foreground flex items-start gap-2 border-t pt-4 text-xs leading-relaxed">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Sessions are kept in httpOnly cookies and are never stored in localStorage. Rowan stores
            no password of its own — credentials are handled by the authentication provider.
          </span>
        </p>
        {footer}
      </CardContent>
    </Card>
  );
}
