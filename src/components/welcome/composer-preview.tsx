import { ArrowUp, Paperclip, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Composer placeholder.
 *
 * This shows where messages will be written, but it is inert: the textarea and
 * the send control are both `disabled`, so it is impossible to type a message
 * or send one. The accompanying copy states exactly what still has to be built.
 */
export function ComposerPreview() {
  return (
    <Card className="overflow-hidden p-0" aria-labelledby="composer-preview-title">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 id="composer-preview-title" className="text-muted-foreground text-xs font-medium">
          Message composer preview
        </h2>
        <Badge variant="outline">Not available · Phase 4</Badge>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <label htmlFor="composer-preview-input" className="text-sm font-medium">
          Message Rowan
        </label>
        <textarea
          id="composer-preview-input"
          disabled
          rows={3}
          placeholder="You will write messages to Rowan here."
          aria-describedby="composer-preview-status"
          className="border-input bg-muted/50 text-muted-foreground placeholder:text-muted-foreground w-full resize-none rounded-lg border px-3 py-2 text-sm disabled:cursor-not-allowed"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled>
            <Paperclip aria-hidden="true" className="size-4" />
            <span>Attach file</span>
            <span className="sr-only">Attachments are planned for phase 6.</span>
          </Button>
          <Button type="button" size="sm" disabled className="ml-auto">
            <span>Send</span>
            <ArrowUp aria-hidden="true" className="size-4" />
            <span className="sr-only">Sending messages is planned for phase 4.</span>
          </Button>
        </div>

        <p
          id="composer-preview-status"
          className="text-muted-foreground flex items-start gap-2 text-xs leading-relaxed"
        >
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Chat, streaming, and saved conversations are Phase 4; secure provider keys are Phase 3.
            Nothing typed here is stored or sent.
          </span>
        </p>
      </div>
    </Card>
  );
}
