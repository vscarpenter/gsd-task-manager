"use client";

import { useState, type ClipboardEvent } from "react";
import { extractUrlsFromTitle, parseCapture } from "@/lib/capture-parser";
import { SCHEMA_LIMITS } from "@/lib/constants/schema";
import { hasVisibleText } from "@/lib/utils";
import type { CapturePayload } from "./capture-bar";

const MAX_PASTE_LINES = 20;
const PASTE_LIMIT_NOTE = `Paste up to ${MAX_PASTE_LINES} lines at a time.`;

type Submit = (payload: CapturePayload) => void | boolean | Promise<void | boolean>;

/** Saving stops at the first failure, so check every title before saving any. */
function tooLongLine(items: CapturePayload[]): number | null {
  const index = items.findIndex(
    (item) => extractUrlsFromTitle(item.title).cleanTitle.length > SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH
  );
  return index < 0 ? null : index + 1;
}

async function saveInOrder(items: CapturePayload[], onSubmit: Submit): Promise<number> {
  let added = 0;
  for (const item of items) {
    try {
      if ((await onSubmit(item)) === false) break;
    } catch {
      // The caller reports the failure; stop so later lines don't land out of order.
      break;
    }
    added += 1;
  }
  return added;
}

/**
 * A single-line input flattens pasted line breaks into one run-on title.
 * This reads the clipboard instead and captures each line as its own task,
 * through the same submit path, in order. The parser itself is untouched.
 */
export function useCapturePaste(onSubmit: Submit, onCaptured: () => void) {
  const [pasteNote, setPasteNote] = useState<string | null>(null);

  const onPaste = async (e: ClipboardEvent<HTMLInputElement>): Promise<void> => {
    const pasted = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(pasted)) return;
    const lines = pasted.split(/\r?\n|\r/).filter(hasVisibleText);
    if (lines.length < 2) return;
    e.preventDefault();
    if (lines.length > MAX_PASTE_LINES) {
      setPasteNote(PASTE_LIMIT_NOTE);
      return;
    }
    const items = lines
      .map((line) => parseCapture(line))
      .filter((item) => hasVisibleText(item.title))
      .map(({ title, urgent, important, tags }) => ({ title, urgent, important, tags }));
    const badLine = tooLongLine(items);
    if (badLine !== null) {
      setPasteNote(`Line ${badLine} is over ${SCHEMA_LIMITS.TASK_TITLE_MAX_LENGTH} characters, so nothing was added. Shorten it and paste again.`);
      return;
    }
    setPasteNote(null);
    const added = await saveInOrder(items, onSubmit);
    if (added < items.length) {
      setPasteNote(`Added ${added} of ${items.length} lines. The rest were not added.`);
      return;
    }
    onCaptured();
  };

  return { pasteNote, onPaste, clearPasteNote: () => setPasteNote(null) };
}
