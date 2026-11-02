"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildBookmarkletHref } from "@/lib/bookmarklet";
import { SettingsRow } from "./shared-components";

interface BookmarkletRowProps {
  tags: string;
}

function handleLinkClick(event: MouseEvent<HTMLAnchorElement>): void {
  // The app's CSP blocks javascript: navigation here anyway. Say what to do instead.
  event.preventDefault();
  toast("Drag this link to your bookmarks bar, then click it on any page.");
}

function BookmarkletDragRow({ tags }: BookmarkletRowProps) {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hintId = useId();

  // React replaces a javascript: href prop with a throwing stub, so the real
  // link goes straight onto the DOM node. Keep this anchor free of an href prop.
  useEffect(() => {
    linkRef.current?.setAttribute("href", buildBookmarkletHref(window.location.origin, tags));
  }, [tags]);

  return (
    <SettingsRow
      label="Drag to your bookmarks bar"
      description="Press Ctrl+Shift+B or ⌘⇧B if the bar is hidden."
    >
      <a
        ref={linkRef}
        aria-describedby={hintId}
        className="btn btn-primary min-h-11 cursor-grab"
        onClick={handleLinkClick}
      >
        Add to GSD
      </a>
      <span id={hintId} hidden>
        Drag this link to your bookmarks bar. If you can&apos;t drag, use Copy code below.
      </span>
    </SettingsRow>
  );
}

function BookmarkletCopyRow({ tags }: BookmarkletRowProps) {
  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildBookmarkletHref(window.location.origin, tags));
      toast.success("Bookmarklet copied");
    } catch {
      toast.error("Couldn't copy the bookmarklet. Please try again.");
    }
  };

  return (
    <SettingsRow
      label="Or install by copying"
      description="For phones, or if dragging doesn't work. Save a bookmark for any page, then replace its URL with this code."
    >
      <Button variant="subtle" className="min-h-11" onClick={handleCopy}>
        Copy code
      </Button>
    </SettingsRow>
  );
}

export function BookmarkletSettings() {
  const [tags, setTags] = useState("");

  return (
    <>
      <SettingsRow
        label="Default tags"
        description="Optional. Added to every capture, separated by commas. Set these before you install."
      >
        <Input
          aria-label="Default tags"
          autoComplete="off"
          className="text-base sm:w-48 sm:text-sm"
          onChange={(event) => setTags(event.target.value)}
          placeholder="reading, inbox"
          value={tags}
        />
      </SettingsRow>

      <BookmarkletDragRow tags={tags} />
      <BookmarkletCopyRow tags={tags} />

      <p className="px-4 py-3.5 text-xs leading-relaxed text-foreground-muted">
        Click the bookmark on any page. GSD opens in a new tab with the page&apos;s title and link
        filled in. Nothing saves until you choose Create task, and opening GSD sends no page
        details over the network.
      </p>
    </>
  );
}
