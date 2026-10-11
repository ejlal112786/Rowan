import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkspaceReadiness } from "@/components/welcome/workspace-readiness";
import { appConfig } from "@/config/app";

describe("WorkspaceReadiness", () => {
  it("marks only the current phase as available", () => {
    render(<WorkspaceReadiness />);

    expect(screen.getAllByText("Available")).toHaveLength(1);

    const availableRow = screen
      .getByText("Application shell, theming, and navigation")
      .closest("li");
    expect(availableRow).not.toBeNull();
    expect(within(availableRow as HTMLElement).getByText("Available")).toBeInTheDocument();
  });

  it("labels the unbuilt capabilities with their delivery phase", () => {
    render(<WorkspaceReadiness />);

    const accountsRow = screen.getByText("Accounts and sign-in").closest("li");
    expect(within(accountsRow as HTMLElement).getByText("Phase 2")).toBeInTheDocument();

    const chatRow = screen.getByText("Chat, streaming, and saved conversations").closest("li");
    expect(within(chatRow as HTMLElement).getByText("Phase 4")).toBeInTheDocument();
  });

  it("never claims that a provider is called or data is stored", () => {
    render(<WorkspaceReadiness />);

    expect(
      screen.getByText(/No AI provider is called and nothing is persisted/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Phase ${appConfig.phase.current} of ${appConfig.phase.total}`)),
    ).toBeInTheDocument();
  });
});
