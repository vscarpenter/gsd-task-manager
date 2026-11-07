import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SweepLink } from "@/components/weekly-sweep/sweep-link";

describe("SweepLink", () => {
  it("always offers Start weekly sweep on the Review page", () => {
    render(<SweepLink />);

    expect(screen.getByRole("link", { name: "Start weekly sweep" })).toHaveAttribute("href", "/sweep");
  });
});
