import { Scale } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-shell";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { plannedProviders } from "@/config/providers";

export const metadata: Metadata = {
  title: "Model Arena",
  description: "Compare responses from multiple providers side by side.",
};

/**
 * Model Arena entry point.
 *
 * Describes the planned comparison workflow without rendering a fake arena:
 * there are no inputs, no results, and no metrics that could be mistaken for
 * real output.
 */
export default function ComparePage() {
  return (
    <PageContainer>
      <PageHeader
        title="Model Arena"
        description="Send one prompt to several providers and compare their answers, latency, and cost side by side."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale aria-hidden="true" className="text-muted-foreground size-4" />
              How the Arena will work
            </CardTitle>
            <CardDescription>
              Nothing here executes yet. Each step below is planned work, not a current capability.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-col gap-3 text-sm">
              <li className="flex gap-3">
                <Badge variant="outline" className="h-5 shrink-0 px-2">
                  1
                </Badge>
                <span className="text-muted-foreground leading-relaxed">
                  Choose two or more connected models (Phase 3 provides the adapters, Phase 5 the
                  catalogue).
                </span>
              </li>
              <li className="flex gap-3">
                <Badge variant="outline" className="h-5 shrink-0 px-2">
                  2
                </Badge>
                <span className="text-muted-foreground leading-relaxed">
                  Send the same prompt to each provider from the server, with streaming responses.
                </span>
              </li>
              <li className="flex gap-3">
                <Badge variant="outline" className="h-5 shrink-0 px-2">
                  3
                </Badge>
                <span className="text-muted-foreground leading-relaxed">
                  Compare answers, token usage, latency, and estimated cost, then promote the best
                  result into a conversation.
                </span>
              </li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Arena-ready providers</CardTitle>
            <CardDescription>
              Comparison requires at least two connected providers. None are connected yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-border flex flex-col divide-y">
              {plannedProviders.map((provider) => (
                <li
                  key={provider.id}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 flex-1 text-sm">{provider.name}</span>
                  <Badge variant="muted" className="shrink-0">
                    No adapter · Phase {provider.integrationPhase}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <PlannedFeatureNotice phase={5} title="Model comparison">
        Multi-model runs, side-by-side streaming, and cost/latency scoring are delivered in Phase 5.
      </PlannedFeatureNotice>
    </PageContainer>
  );
}
