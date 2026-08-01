"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/sentry";

/**
 * Next.js global error page — catches errors in the root layout itself.
 *
 * Uses inline styles because globals.css is loaded by the root layout which
 * may have crashed. Colors align with the Inkwell design system tokens
 * (ivory, slate, accent) to maintain visual consistency even in degraded state.
 * Style objects are hoisted to module scope so they aren't rebuilt per render
 * and so the JSX stays self-contained (global-error must not depend on app CSS).
 */
const preStyle: React.CSSProperties = {
  marginTop: "0.5rem",
  padding: "1rem",
  background: "#F7F7FA",
  border: "1px solid #D9D9E4",
  borderRadius: "0.625rem",
  fontSize: "0.75rem",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const tryAgainButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  /* Violet Frost aubergine. Hard-coded: global-error renders outside
     the root layout, so the token cascade isn't available here. */
  background: "#5C4F7D",
  color: "#FDFDFF",
  border: "none",
  borderRadius: "0.625rem",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "0.875rem",
};

const goHomeButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "transparent",
  color: "#242331",
  border: "1px solid #D9D9E4",
  borderRadius: "0.625rem",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "0.875rem",
};

const fallbackThemeCss = `
  :root {
    color-scheme: light;
    --error-canvas: #F3F3F7;
    --error-paper: #FDFDFF;
    --error-ink: #242331;
    --error-muted: #646477;
    --error-raised: #F7F7FA;
    --error-border: #D9D9E4;
    --error-control-border: #8D8C9D;
    --error-accent: #5C4F7D;
    --error-on-accent: #FDFDFF;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --error-canvas: #14131B;
      --error-paper: #211F2B;
      --error-ink: #ECEAF2;
      --error-muted: #AAA6B8;
      --error-raised: #191821;
      --error-border: #393645;
      --error-control-border: #6F6B80;
      --error-accent: #A99BCB;
      --error-on-accent: #14131B;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --error-canvas: #14131B;
    --error-paper: #211F2B;
    --error-ink: #ECEAF2;
    --error-muted: #AAA6B8;
    --error-raised: #191821;
    --error-border: #393645;
    --error-control-border: #6F6B80;
    --error-accent: #A99BCB;
    --error-on-accent: #14131B;
  }
  body { background: var(--error-canvas) !important; color: var(--error-ink) !important; }
  .global-error-muted { color: var(--error-muted) !important; }
  .global-error-pre { background: var(--error-raised) !important; border-color: var(--error-border) !important; }
  .global-error-primary { background: var(--error-accent) !important; color: var(--error-on-accent) !important; }
  .global-error-secondary { color: var(--error-ink) !important; border-color: var(--error-control-border) !important; }
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest });
    try {
      const savedTheme = window.localStorage.getItem("gsd-theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        document.documentElement.dataset.theme = savedTheme;
      }
    } catch {
      // A degraded fallback must stay renderable even when storage is blocked.
    }
  }, [error]);

  return (
    <html lang="en">
      <head>
        <style>{fallbackThemeCss}</style>
      </head>
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#F3F3F7",
          color: "#242331",
          margin: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.75rem" }}>
            Something went wrong
          </h1>
          <p
            className="global-error-muted"
            style={{
              color: "#646477",
              maxWidth: "28rem",
              textAlign: "center",
              margin: "0 0 1rem",
              lineHeight: 1.5,
            }}
          >
            An unexpected error occurred. Your data is safe in local storage.
          </p>
          {error?.message && (
            <details
              style={{
                marginTop: "0.5rem",
                textAlign: "left",
                width: "100%",
                maxWidth: "28rem",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: "0.875rem",
                  color: "#646477",
                }}
                className="global-error-muted"
              >
                Error details
              </summary>
              <pre className="global-error-pre" style={preStyle}>
                {error.message}
              </pre>
            </details>
          )}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button className="global-error-primary" type="button" onClick={reset} style={tryAgainButtonStyle}>
              Try again
            </button>
            <button
              type="button"
              className="global-error-secondary"
              onClick={() => {
                window.location.href = "/";
              }}
              style={goHomeButtonStyle}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
