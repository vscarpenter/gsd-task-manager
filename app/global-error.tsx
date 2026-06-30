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
  background: "#f3f4f6",
  borderRadius: "0.375rem",
  fontSize: "0.75rem",
  overflow: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const tryAgainButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  /* Editorial tide (--accent). Hard-coded: global-error renders outside
     the root layout, so the token cascade isn't available here. */
  background: "#2C6680",
  color: "#fff",
  border: "none",
  borderRadius: "0.375rem",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "0.875rem",
};

const goHomeButtonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  background: "transparent",
  color: "#13141b",
  border: "1.5px solid #d1d5db",
  borderRadius: "0.375rem",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "0.875rem",
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { digest: error.digest });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: "#fafaf9",
          color: "#13141b",
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
            style={{
              color: "#6b7280",
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
                  color: "#6b7280",
                }}
              >
                Error details
              </summary>
              <pre style={preStyle}>
                {error.message}
              </pre>
            </details>
          )}
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
            <button type="button" onClick={reset} style={tryAgainButtonStyle}>
              Try again
            </button>
            <button
              type="button"
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
