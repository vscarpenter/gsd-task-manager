"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { TagAutocompleteInput } from "@/components/tag-autocomplete-input";
import { useAllTags } from "@/lib/use-all-tags";
import { XIcon } from "lucide-react";

interface BulkTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (tags: string[]) => void;
  selectedCount: number;
}

/**
 * Dialog for adding tags to multiple tasks at once
 */
export function BulkTagDialog({ open, onOpenChange, onConfirm, selectedCount }: BulkTagDialogProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const allTags = useAllTags();

  const availableSuggestions = allTags.filter(t => !tags.includes(t));

  const addTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    setTags([...tags, trimmed]);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleConfirm = () => {
    onConfirm(tags);
    setTags([]);
    setNewTag("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setTags([]);
    setNewTag("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Tags to {selectedCount} Tasks</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Select or enter tags</Label>
            <div className="flex gap-2">
              <TagAutocompleteInput
                placeholder="Add tag (e.g., work, urgent)"
                value={newTag}
                onChange={setNewTag}
                suggestions={availableSuggestions}
                onSelect={(tag) => {
                  if (!tags.includes(tag)) {
                    setTags([...tags, tag]);
                  }
                  setNewTag("");
                }}
                onEnterWithoutSelection={addTag}
              />
              <Button type="button" onClick={addTag} variant="subtle">
                Add
              </Button>
            </div>
          </div>

          {tags.length > 0 && (
            <div className="space-y-2">
              <Label>Tags to add:</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-accent-foreground"
                      aria-label={`Remove ${tag}`}
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="subtle" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={tags.length === 0}>
            Add Tags to {selectedCount} Tasks
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
