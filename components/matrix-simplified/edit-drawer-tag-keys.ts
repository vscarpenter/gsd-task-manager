import type { KeyboardEvent } from "react";
import { isImeComposing } from "@/lib/ime";
import type { useEditDraftState } from "./use-edit-draft-state";

type TagDraft = Pick<ReturnType<typeof useEditDraftState>, "addTag" | "setTags" | "tagInput" | "tags">;

/**
 * Enter/comma commits a tag; Backspace on an empty input removes the last one.
 * While an IME composes, Enter confirms a conversion and comma types its
 * punctuation, so neither commits. Enter is swallowed either way, because in
 * the drawer's form it would submit.
 */
export function handleTagKeyDown(event: KeyboardEvent, draft: TagDraft): void {
  if (event.key === "Enter") event.preventDefault();
  if (event.key === "Enter" || event.key === ",") {
    if (isImeComposing(event.nativeEvent)) return;
    event.preventDefault();
    draft.addTag();
    return;
  }
  if (event.key === "Backspace" && !draft.tagInput && draft.tags.length) {
    draft.setTags(draft.tags.slice(0, -1));
  }
}
