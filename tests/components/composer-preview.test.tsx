import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComposerPreview } from "@/components/welcome/composer-preview";

describe("ComposerPreview", () => {
  it("renders an inert composer: the message field and both actions are disabled", () => {
    render(<ComposerPreview />);

    expect(screen.getByLabelText("Message Rowan")).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /attach file/i })).toBeDisabled();
  });

  it("states that messaging is not available yet", () => {
    render(<ComposerPreview />);

    expect(screen.getByText("Not available · Phase 4")).toBeInTheDocument();
    expect(
      screen.getByText(/Chat, streaming, and saved conversations are Phase 4/i),
    ).toBeInTheDocument();
  });

  it("describes the disabled send control to assistive technology", () => {
    render(<ComposerPreview />);

    const send = screen.getByRole("button", { name: /send/i });
    expect(send).toHaveTextContent("Sending messages is planned for phase 4.");
  });

  it("exposes a labelled region heading", () => {
    render(<ComposerPreview />);

    expect(screen.getByRole("heading", { name: "Message composer preview" })).toBeInTheDocument();
  });
});
