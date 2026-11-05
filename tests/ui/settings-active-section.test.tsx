import { afterEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useInsertionEffect } from "react";
import { useActiveSection } from "@/components/settings-page/use-active-section";

function Probe() {
  const { activeSection, selectSection } = useActiveSection(true);
  return (
    <>
      <output data-testid="active">{activeSection}</output>
      <button type="button" onClick={() => selectSection("about")}>
        about
      </button>
    </>
  );
}

/** Next's App Router writes the URL in an insertion effect, after the new page has rendered. */
function UrlUpdatedAfterRender({ hash }: { hash: string }) {
  useInsertionEffect(() => {
    window.history.pushState(null, "", hash);
  }, [hash]);
  return null;
}

describe("useActiveSection", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("opens the section from a hash written after the first render, as a client-side link does", () => {
    render(
      <>
        <Probe />
        <UrlUpdatedAfterRender hash="#feedback" />
      </>
    );
    expect(screen.getByTestId("active")).toHaveTextContent("feedback");
  });

  it("follows a later hashchange", () => {
    render(<Probe />);
    act(() => {
      window.history.pushState(null, "", "#notifications");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByTestId("active")).toHaveTextContent("notifications");
  });

  it("selects a section and reflects it in the hash", () => {
    render(<Probe />);
    act(() => screen.getByRole("button", { name: "about" }).click());
    expect(screen.getByTestId("active")).toHaveTextContent("about");
    expect(window.location.hash).toBe("#about");
  });
});
