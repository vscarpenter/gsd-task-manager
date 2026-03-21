import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { QueryProvider } from "@/components/query-provider";

function TestConsumer() {
  const queryClient = useQueryClient();
  return (
    <div data-testid="consumer">
      {queryClient ? "QueryClient available" : "No QueryClient"}
    </div>
  );
}

describe("QueryProvider", () => {
  it("provides QueryClient to children", () => {
    render(
      <QueryProvider>
        <TestConsumer />
      </QueryProvider>
    );

    expect(screen.getByTestId("consumer")).toHaveTextContent(
      "QueryClient available"
    );
  });

  it("renders children correctly", () => {
    render(
      <QueryProvider>
        <div data-testid="child">Hello</div>
      </QueryProvider>
    );

    expect(screen.getByTestId("child")).toHaveTextContent("Hello");
  });
});
