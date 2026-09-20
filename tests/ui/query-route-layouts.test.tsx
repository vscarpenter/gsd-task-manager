import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { useQueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import ArchiveLayout from "@/app/(archive)/layout";
import SyncLayout from "@/app/(sync)/layout";

// useQueryClient throws without a provider above it, so rendering this proves
// the layout supplies one.
function QueryClientProbe({ label }: { label: string }) {
  useQueryClient();
  return <p>{label}</p>;
}

describe("react-query route layouts", () => {
  it("should_give_archive_and_sync_history_children_a_query_client", () => {
    render(
      <ArchiveLayout>
        <QueryClientProbe label="archive has a query client" />
      </ArchiveLayout>
    );
    render(
      <SyncLayout>
        <QueryClientProbe label="sync history has a query client" />
      </SyncLayout>
    );

    expect(screen.getByText("archive has a query client")).toBeInTheDocument();
    expect(screen.getByText("sync history has a query client")).toBeInTheDocument();
  });

  // Only /archive and /sync-history use react-query. A provider in the root
  // layout puts the library in the chunks every route downloads.
  it("should_keep_the_query_provider_out_of_the_root_layout", () => {
    const rootLayout = readFileSync("app/layout.tsx", "utf8");

    expect(rootLayout).not.toContain("query-provider");
    expect(rootLayout).not.toContain("@tanstack/react-query");
  });
});
