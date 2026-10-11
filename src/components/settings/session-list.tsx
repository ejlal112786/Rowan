import { Laptop } from "lucide-react";

import { RevokeSessionButton } from "@/components/settings/revoke-session-button";
import { Badge } from "@/components/ui/badge";
import type { SessionRecord } from "@/lib/data/sessions";

/**
 * Live sessions, each individually revocable.
 *
 * Server-side revocation is the point: revoking writes to `public.user_sessions`, and every
 * authenticated request checks that record, so a session ends immediately rather than when
 * its token happens to expire. The list shows only what the database knows (creation and
 * last-seen times, and a device hint) — never a token, and never a full user-agent string
 * beyond the length the schema stores.
 */
function formatTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}

export function SessionList({
  sessions,
  currentSessionId,
}: {
  sessions: readonly SessionRecord[];
  currentSessionId: string | null;
}) {
  if (sessions.length === 0) {
    return (
      <p className="text-muted-foreground text-sm leading-relaxed">
        No sessions recorded yet. Rowan records a session the first time it authenticates one, so
        this list fills in as you sign in from other browsers.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {sessions.map((session) => {
        const isCurrent = currentSessionId !== null && session.session_id === currentSessionId;
        const isRevoked = session.revoked_at !== null;

        return (
          <li
            key={session.session_id}
            className="border-border flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                <Laptop aria-hidden="true" className="text-muted-foreground size-4" />
                <span className="truncate">{session.user_agent ?? "Unknown device"}</span>
                {isCurrent ? <Badge variant="secondary">This device</Badge> : null}
                {isRevoked ? <Badge variant="muted">Revoked</Badge> : null}
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Started {formatTimestamp(session.created_at)} UTC · last active{" "}
                {formatTimestamp(session.last_seen_at)} UTC
                {session.revoked_reason === null ? "" : ` · ${session.revoked_reason}`}
              </p>
            </div>

            {isRevoked ? null : <RevokeSessionButton sessionId={session.session_id} />}
          </li>
        );
      })}
    </ul>
  );
}
