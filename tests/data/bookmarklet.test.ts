import { describe, it, expect, vi } from "vitest";
import { buildBookmarkletHref } from "@/lib/bookmarklet";
import { parseShareCaptureParams } from "@/lib/share-capture";

const GSD_ORIGIN = "https://gsd.vinny.dev";
const SCHEME = "javascript:";

interface FakePage {
  title: string;
  href: string;
}

/** Runs the link the way a browser does: percent-decode, then execute on the page. */
function clickBookmarklet(href: string, page: FakePage) {
  const open = vi.fn();
  const source = decodeURIComponent(href.slice(SCHEME.length));
  const run = new Function("document", "location", "window", source);
  run({ title: page.title }, { href: page.href }, { open });
  return open;
}

function captureFrom(open: ReturnType<typeof vi.fn>) {
  const destination = new URL(open.mock.calls[0][0] as string);
  return parseShareCaptureParams(new URLSearchParams(destination.hash.slice(1)));
}

describe("buildBookmarkletHref", () => {
  const article: FakePage = {
    title: "Read this article",
    href: "https://example.com/post?id=7",
  };

  it("should_open_gsd_in_a_new_tab_without_exposing_the_page_to_it", () => {
    const open = clickBookmarklet(buildBookmarkletHref(GSD_ORIGIN, ""), article);

    expect(open).toHaveBeenCalledTimes(1);
    const [destination, target, features] = open.mock.calls[0];
    expect((destination as string).startsWith(`${GSD_ORIGIN}/#action=capture&`)).toBe(true);
    expect(target).toBe("_blank");
    expect(features).toBe("noopener,noreferrer");
  });

  it("should_send_page_details_only_in_the_fragment", () => {
    const open = clickBookmarklet(buildBookmarkletHref(GSD_ORIGIN, "reading"), article);

    const destination = new URL(open.mock.calls[0][0] as string);
    expect(destination.pathname).toBe("/");
    expect(destination.search).toBe("");
  });

  it("should_produce_a_draft_from_the_page_title_and_url", () => {
    const open = clickBookmarklet(buildBookmarkletHref(GSD_ORIGIN, ""), article);

    expect(captureFrom(open)).toEqual({
      title: "Read this article",
      description: "https://example.com/post?id=7",
      urgent: false,
      important: false,
      tags: [],
    });
  });

  it("should_fall_back_to_the_hostname_when_the_page_has_no_title", () => {
    const open = clickBookmarklet(buildBookmarkletHref(GSD_ORIGIN, ""), {
      title: "",
      href: "https://example.com/post",
    });

    expect(captureFrom(open)?.title).toBe("example.com");
  });

  it("should_keep_reserved_characters_in_page_details_intact", () => {
    const open = clickBookmarklet(buildBookmarkletHref(GSD_ORIGIN, ""), {
      title: "100% done & #1 on \"HN\"",
      href: "https://example.com/a%20b?x=1&y=2#top",
    });

    const draft = captureFrom(open);
    expect(draft?.title).toBe("100% done & #1 on \"HN\"");
    expect(draft?.description).toBe("https://example.com/a%20b?x=1&y=2#top");
  });

  it("should_add_the_default_tags_to_the_capture", () => {
    const open = clickBookmarklet(buildBookmarkletHref(GSD_ORIGIN, "Reading, inbox"), article);

    expect(captureFrom(open)?.tags).toEqual(["reading", "inbox"]);
  });

  it.each([
    ["a double quote", 'x",alert(1),"y'],
    ["a percent-encoded quote", "x%22,alert(1),%22y"],
    ["a backslash", "x\\"],
    ["a line separator", "x y"],
    ["a closing script tag", "</script><script>alert(1)</script>"],
  ])("should_not_let_%s_in_tags_escape_into_code", (_label, hostileTags) => {
    const open = clickBookmarklet(buildBookmarkletHref(GSD_ORIGIN, hostileTags), article);

    expect(open).toHaveBeenCalledTimes(1);
    const destination = new URL(open.mock.calls[0][0] as string);
    const params = new URLSearchParams(destination.hash.slice(1));
    expect(params.get("tags")).toBe(hostileTags);
  });

  it("should_produce_a_single_line_link_that_encodes_literal_percent_signs", () => {
    const href = buildBookmarkletHref(GSD_ORIGIN, 'tag"%22');

    expect(href.startsWith(SCHEME)).toBe(true);
    expect(href).not.toMatch(/[\s"]/);
    expect(href).toContain("%2522");
  });
});
