import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewChatButton } from "@/components/app-shell/new-chat-button";
import { newChatAction } from "@/config/navigation";

describe("NewChatButton", () => {
  it("renders a disabled control that cannot be activated", () => {
    render(<NewChatButton />);

    const button = screen.getByRole("button", { name: /new chat/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveAttribute("data-slot", "button");
  });

  it("does not register a click handler", () => {
    render(<NewChatButton />);

    const button = screen.getByRole("button", { name: /new chat/i });
    expect(button).not.toHaveAttribute("onclick");
  });

  it("states the phase that delivers the feature", () => {
    render(<NewChatButton />);

    expect(screen.getByText(`Phase ${newChatAction.phase}`)).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`Conversations arrive in Phase ${newChatAction.phase}`)),
    ).toBeInTheDocument();
  });
});
