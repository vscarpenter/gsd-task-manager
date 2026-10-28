import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { HeroSection } from "@/components/about/hero-section";

describe("about-page hero", () => {
  // ScrollReveal adds its visible class in an effect, so anything inside it is
  // opacity 0 until hydration finishes. On slow 3G that hid the hero and Open
  // App for about 28 s. Above-the-fold content has to be visible in the HTML.
  it("renders visible in static markup, before any script runs", () => {
    const html = renderToStaticMarkup(<HeroSection />);
    expect(html).toContain("Open App");
    expect(html).not.toContain("scroll-reveal");
  });

  it("links the MIT badge to the repository", () => {
    const html = renderToStaticMarkup(<HeroSection />);
    expect(html).toMatch(
      /<a[^>]*href="https:\/\/github\.com\/vscarpenter\/gsd-task-manager"[^>]*>(?:(?!<\/a>).)*MIT open source/s,
    );
  });

  it("spells out GSD", () => {
    const html = renderToStaticMarkup(<HeroSection />);
    expect(html).toContain("Get Stuff Done");
  });
});
