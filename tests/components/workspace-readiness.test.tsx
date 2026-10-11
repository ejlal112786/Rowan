import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceReadiness } from "@/components/welcome/workspace-readiness";
import { appConfig } from "@/config/app";

describe("WorkspaceReadiness", () => {
  it("marks only the current phase as available", () => {
    render(<WorkspaceReadiness />);

    expect(screen.getAllByText("Available")).toHaveLength(1);

    const availableRow = screen.getByText("Accounts, profiles, and sessions").closest("li");
    expect(availableRow).not.toBeNull();
    expect(within(availableRow as HTMLElement).getByText("Available")).toBeInTheDocument();

    // The Phase 1 row describes the shell, which is still working — it is not labelled
    // "Available" twice, because exactly one phase is the current one.
    const shellRow = screen.getByText("Application shell, theming, and navigation").closest("li");
    expect(within(shellRow as HTMLElement).queryByText("Available")).toBeNull();
  });

  it("labels the unbuilt capabilities with their delivery phase", () => {
    render(<WorkspaceReadiness />);

    const providersRow = screen.getByText("Provider keys and model catalogue").closest("li");
    expect(within(providersRow as HTMLElement).getByText("Phase 3")).toBeInTheDocument();

    const chatRow = screen.getByText("Chat, streaming, and saved conversations").closest("li");
    expect(within(chatRow as HTMLElement).getByText("Phase 4")).toBeInTheDocument();
  });

  it("never claims that a provider is called or that a response is generated", () => {
    render(<WorkspaceReadiness />);

    expect(screen.getByText(/no AI provider is called yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Phase ${appConfig.phase.current} of ${appConfig.phase.total}`)),
    ).toBeInTheDocument();
  });
});
