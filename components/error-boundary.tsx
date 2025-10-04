"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: unknown) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
          <div className="text-center space-y-3">
            <h1 className="text-4xl font-bold">Something went wrong</h1>
            <p className="text-muted-foreground max-w-md">
              An unexpected error occurred. Your data is safe in local storage.
            </p>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  Error details
                </summary>
                <pre className="mt-2 rounded-md bg-muted p-4 text-xs overflow-auto">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
          <div className="flex gap-3">
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button variant="subtle" onClick={() => window.location.href = "/"}>
              Go home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
