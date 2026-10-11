import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { newChatAction } from "@/config/navigation";

/**
 * The shell's primary action, which is not available yet.
 *
 * The control is genuinely disabled — it has no handler and cannot be
 * activated — and its planned phase is stated in visible text plus an
 * assistive-technology-only description. Nothing here implies a conversation
 * can be started.
 */
export function NewChatButton() {
  const { icon: Icon, label, phase } = newChatAction;

  return (
    <div className="flex flex-col gap-1.5">
      <Button type="button" disabled className="w-full justify-start">
        <Icon aria-hidden="true" className="size-4" />
        <span>{label}</span>
        <Badge variant="muted" className="ml-auto px-2 text-[0.6875rem]">
          Phase {phase}
        </Badge>
        <span className="sr-only">
          New chat is not available yet. It is planned for phase {phase}.
        </span>
      </Button>
      <p className="text-muted-foreground px-1 text-xs leading-relaxed">
        Conversations arrive in Phase {phase}.
      </p>
    </div>
  );
}
