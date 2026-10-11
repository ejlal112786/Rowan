import { Plug } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { plannedProviders } from "@/config/providers";

/**
 * Provider readiness overview.
 *
 * Read-only status: every provider shows "Not connected" because no adapter,
 * key storage, or network call exists yet. This is a roadmap surface, not a
 * connection manager — the real one is built in Phase 3.
 */
export function ProviderReadiness() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug aria-hidden="true" className="text-muted-foreground size-4" />
          Providers
        </CardTitle>
        <CardDescription>
          Rowan will connect to your own provider accounts. No provider is connected in this build.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-border flex flex-col divide-y">
          {plannedProviders.map((provider) => (
            <li key={provider.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{provider.name}</p>
                <p className="text-muted-foreground text-xs leading-relaxed">{provider.summary}</p>
              </div>
              <Badge variant="muted" className="mt-0.5 shrink-0">
                Not connected · Phase {provider.integrationPhase}
              </Badge>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
