"use client";

import "./globals.css";

/**
 * Last-resort error boundary for failures in the root layout itself.
 *
 * It must render its own <html> and <body> and cannot rely on any styling or
 * provider from the root layout, so it stays deliberately minimal and uses
 * inline styles.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          backgroundColor: "#ffffff",
          color: "#16181d",
        }}
      >
        <main style={{ maxWidth: "32rem" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.75rem" }}>
            Rowan could not start
          </h1>
          <p style={{ fontSize: "0.875rem", lineHeight: 1.6, color: "#5b6169" }}>
            The application shell failed to render. Reload the page; if the problem persists, the
            deployment logs contain the server-side cause.
          </p>
          {error.digest ? (
            <p style={{ fontSize: "0.75rem", color: "#5b6169", marginTop: "0.75rem" }}>
              digest: <code>{error.digest}</code>
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: "1.25rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              borderRadius: "0.5rem",
              border: "1px solid #d6d8dd",
              background: "#ffffff",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
