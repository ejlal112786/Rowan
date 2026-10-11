import { CircleCheck, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { appConfig } from "@/config/app";

type ReadinessItem = {
  label: string;
  /** Phase that delivers the capability; 1 means it ships in this build. */
  phase: number;
  detail: string;
};

const READINESS_ITEMS: readonly ReadinessItem[] = [
  {
    label: "Application shell, theming, and navigation",
    phase: 1,
    detail: "Available now. Responsive layout, light/dark/system theme, keyboard navigation.",
  },
  {
    label: "Accounts, profiles, and sessions",
    phase: 2,
    detail:
      "Available now. Registration, confirmation, sign-in, password reset, profile, session revocation, and account deletion.",
  },
  {
    label: "Provider keys and model catalogue",
    phase: 3,
    detail: "No key is stored, validated, or used to call a provider.",
  },
  {
    label: "Chat, streaming, and saved conversations",
    phase: 4,
    detail: "No message can be composed, sent, or persisted.",
  },
];

/** Factual statement of what does and does not work in this build. */
export function WorkspaceReadiness() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Build status</CardTitle>
        <CardDescription>
          Phase {appConfig.phase.current} of {appConfig.phase.total} —{" "}
          {appConfig.phase.title.toLowerCase()}. Account data is stored in PostgreSQL; no AI
          provider is called yet.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {READINESS_ITEMS.map((item) => {
            const isAvailable = item.phase === appConfig.phase.current;

            return (
              <li key={item.label} className="flex items-start gap-3">
                {isAvailable ? (
                  <CircleCheck
                    aria-hidden="true"
                    className="text-foreground mt-0.5 size-4 shrink-0"
                  />
                ) : (
                  <CircleDashed
                    aria-hidden="true"
                    className="text-muted-foreground mt-0.5 size-4 shrink-0"
                  />
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">{item.detail}</p>
                </div>
                <Badge variant={isAvailable ? "secondary" : "muted"} className="mt-0.5 shrink-0">
                  {isAvailable ? "Available" : `Phase ${item.phase}`}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
