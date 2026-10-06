import { afterAll, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

// The chart's date formatter reads the zone when the module loads, so the zone
// has to be set before the import. Chicago sits behind UTC, where a date-only
// key parsed as UTC midnight shows the previous day.
const originalTimezone = vi.hoisted(() => {
  const saved = process.env.TZ;
  process.env.TZ = "America/Chicago";
  return saved;
});

const captured = vi.hoisted(() => ({ data: [] as Array<{ date: string }> }));

vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    // jsdom has no layout, so the real container never renders its chart.
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => children,
    ComposedChart: ({ data }: { data: Array<{ date: string }> }) => {
      captured.data = data;
      return null;
    },
  };
});

import { CompletionChart } from "@/components/dashboard/completion-chart";

afterAll(() => {
  if (originalTimezone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimezone;
});

describe("CompletionChart dates", () => {
  it("labels each trend point with its own local day", () => {
    render(
      <CompletionChart
        data={[
          { date: "2025-01-01", completed: 1, created: 0 },
          { date: "2025-01-02", completed: 0, created: 2 },
        ]}
      />
    );

    expect(captured.data.map((point) => point.date)).toEqual(["1/1", "1/2"]);
  });
});
