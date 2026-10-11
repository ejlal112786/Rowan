import { MessagesSquare } from "lucide-react";
import type { Metadata } from "next";

import { PageContainer, PageHeader } from "@/components/layout/page-shell";
import { PlannedFeatureNotice } from "@/components/planned-feature-notice";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Conversations",
  description: "Search and revisit saved conversations.",
};

/**
 * Conversations index.
 *
 * There is deliberately no list, no search field, and no "create conversation"
 * affordance: no conversation storage exists yet. The empty state explains what
 * will appear here once Phase 4 ships.
 */
export default function ConversationsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Conversations"
        description="Search and revisit your saved conversations. Storage is not implemented in this phase."
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="border-border bg-muted flex size-10 items-center justify-center rounded-full border">
            <MessagesSquare aria-hidden="true" className="text-muted-foreground size-4" />
          </span>
          <p className="text-sm font-medium">No conversations</p>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
            This list stays empty because Rowan does not store messages yet. It will show real,
            searchable conversations once chat and persistence are built.
          </p>
        </CardContent>
      </Card>

      <PlannedFeatureNotice phase={4} title="Persistent conversations">
        Phase 4 adds the conversation and message schema, streaming responses, and history. Phase 7
        adds full-text search, titles, and workspace organisation.
      </PlannedFeatureNotice>
    </PageContainer>
  );
}
