"use client";

import { Component, createRef, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { createLogger } from "@/lib/logger";

const logger = createLogger("ERROR_BOUNDARY");

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryClass extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private readonly fallbackRef = createRef<HTMLDivElement>();

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    const info = errorInfo as { componentStack?: string } | undefined;
    // logger.error forwards to Sentry; no separate captureException needed.
    logger.error("Error caught by boundary", error, {
      componentStack: info?.componentStack ?? undefined,
    });
    this.fallbackRef.current?.focus({ preventScroll: true });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} fallbackRef={this.fallbackRef} />;
    }

    return this.props.children;
  }
}

function ErrorFallback({
  error,
  fallbackRef,
}: {
  error?: Error;
  fallbackRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={fallbackRef}
      role="alert"
      aria-labelledby="error-boundary-title"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-4"
    >
      <div className="text-center space-y-3">
        <h1 id="error-boundary-title" className="text-4xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-md">
          An unexpected error occurred. Your data is safe in local storage.
        </p>
        {error && <ErrorDetails error={error} />}
      </div>
      <RecoveryActions />
    </div>
  );
}

function ErrorDetails({ error }: { error: Error }) {
  return (
    <details className="mt-4 text-left">
      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
        Error details
      </summary>
      <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto">{error.message}</pre>
    </details>
  );
}

function RecoveryActions() {
  return (
    <div className="flex gap-3">
      <Button onClick={() => window.location.reload()}>Reload page</Button>
      <Button variant="subtle" onClick={navigateHome}>Go home</Button>
    </div>
  );
}

function navigateHome() {
  // The boundary may be recovering from state that a soft navigation retains.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = "/";
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return <ErrorBoundaryClass>{children}</ErrorBoundaryClass>;
}
