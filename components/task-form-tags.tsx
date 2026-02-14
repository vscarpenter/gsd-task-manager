"use client";

import { useState } from "react";
import { useAllTags } from "@/lib/use-all-tags";
import { TagAutocompleteInput } from "@/components/tag-autocomplete-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PlusIcon, XIcon } from "lucide-react";

interface TaskFormTagsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}

/**
 * Tags section for task form
 *
 * Allows adding and removing multiple tags for categorizing tasks
 */
export function TaskFormTags({ tags, onChange, error }: TaskFormTagsProps) {
  const [newTag, setNewTag] = useState("");
  const allTags = useAllTags();

  // Filter out tags that are already added to this task
  const availableSuggestions = allTags.filter((t) => !tags.includes(t));

  const addTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setNewTag("");
  };

  const handleSelectTag = (tag: string) => {
    if (tags.includes(tag)) return;
    onChange([...tags, tag]);
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter(t => t !== tag));
  };

  return (
    <div className="space-y-2">
      <Label>Tags</Label>
      <div className="flex gap-2">
        <TagAutocompleteInput
          placeholder="Add tag (e.g., work, personal)"
          value={newTag}
          onChange={setNewTag}
          suggestions={availableSuggestions}
          onSelect={handleSelectTag}
          onEnterWithoutSelection={addTag}
        />
        <Button
          type="button"
          variant="subtle"
          onClick={addTag}
          className="shrink-0"
          aria-label="Add tag"
        >
          <PlusIcon className="h-4 w-4" />
        </Button>
      </div>
      {tags.length > 0 && (
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
                aria-label={`Remove ${tag} tag`}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
