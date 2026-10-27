"use client";

import { useState, type ClipboardEvent } from "react";
import { parseCapture } from "@/lib/capture-parser";
import { hasVisibleText } from "@/lib/utils";
import type { CapturePayload } from "./capture-bar";

const MAX_PASTE_LINES = 20;
const PASTE_LIMIT_NOTE = `Paste up to ${MAX_PASTE_LINES} lines at a time.`;

type Submit = (payload: CapturePayload) => void | boolean | Promise<void | boolean>;

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
    setPasteNote(null);
    for (const line of lines) {
      const item = parseCapture(line);
      if (!hasVisibleText(item.title)) continue;
      try {
        const saved = await onSubmit({
          title: item.title,
          urgent: item.urgent,
          important: item.important,
          tags: item.tags,
        });
        if (saved === false) return;
      } catch {
        // The caller reports the failure; stop so later lines don't land out of order.
        return;
      }
    }
    onCaptured();
  };

  return { pasteNote, onPaste, clearPasteNote: () => setPasteNote(null) };
}
