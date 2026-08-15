"use client";

import { useEffect, useRef, type RefObject } from "react";
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
  background: "#FBF9F3",
  border: "1px solid #D8D1C1",
  borderRadius: "0.625rem",
  fontSize: "0.75rem",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const tryAgainButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  /* Editorial tide. Hard-coded: global-error renders outside
     the root layout, so the token cascade isn't available here. */
  background: "#2C6680",
  color: "#FFFFFF",
  border: "none",
  borderRadius: "0.625rem",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "0.875rem",
};

const goHomeButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "transparent",
  color: "#211E1A",
  border: "1px solid #D8D1C1",
  borderRadius: "0.625rem",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "0.875rem",
};

const fallbackThemeCss = `
  :root {
    color-scheme: light;
    --error-canvas: #F4F1E9;
    --error-paper: #FFFFFF;
    --error-ink: #211E1A;
    --error-muted: #6E6760;
    --error-raised: #FBF9F3;
    --error-border: #D8D1C1;
    --error-control-border: #938A7B;
    --error-accent: #2C6680;
    --error-on-accent: #FFFFFF;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --error-canvas: #17150F;
      --error-paper: #221E17;
      --error-ink: #F1ECE2;
      --error-muted: #A79F92;
      --error-raised: #1B1812;
      --error-border: #322D24;
      --error-control-border: #746A5B;
      --error-accent: #6FAACB;
      --error-on-accent: #17150F;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --error-canvas: #17150F;
    --error-paper: #221E17;
    --error-ink: #F1ECE2;
    --error-muted: #A79F92;
    --error-raised: #1B1812;
    --error-border: #322D24;
    --error-control-border: #746A5B;
    --error-accent: #6FAACB;
    --error-on-accent: #17150F;
  }
  body { background: var(--error-canvas) !important; color: var(--error-ink) !important; }
  .global-error-muted { color: var(--error-muted) !important; }
  .global-error-pre { background: var(--error-raised) !important; border-color: var(--error-border) !important; }
  .global-error-primary { background: var(--error-accent) !important; color: var(--error-on-accent) !important; }
  .global-error-secondary { color: var(--error-ink) !important; border-color: var(--error-control-border) !important; }
`;

function useGlobalErrorFallback(
  error: Error & { digest?: string },
  fallbackRef: RefObject<HTMLDivElement | null>
) {
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
    fallbackRef.current?.focus({ preventScroll: true });
  }, [error, fallbackRef]);
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  useGlobalErrorFallback(error, fallbackRef);

  return (
    <html lang="en">
      <head>
        <style>{fallbackThemeCss}</style>
      </head>
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#F4F1E9",
          color: "#211E1A",
          margin: 0,
        }}
      >
        <div
          ref={fallbackRef}
          role="alert"
          aria-labelledby="global-error-title"
          tabIndex={-1}
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
        >
          <h1
            id="global-error-title"
            style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 0.75rem" }}
          >
            Something went wrong
          </h1>
          <p
            className="global-error-muted"
            style={{
              color: "#6E6760",
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
                  color: "#6E6760",
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
                // The root layout failed, so the client router may not be usable.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
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
