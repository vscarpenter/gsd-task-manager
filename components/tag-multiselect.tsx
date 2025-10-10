"use client";

import { useState, useMemo } from "react";
import { CheckIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TagMultiselectProps {
  availableTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagMultiselect({ availableTags, selectedTags, onChange }: TagMultiselectProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTags = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return availableTags;
    return availableTags.filter(tag => tag.toLowerCase().includes(query));
  }, [availableTags, searchQuery]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setSearchQuery("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold uppercase tracking-wide">
          Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
        </Label>
        {selectedTags.length > 0 && (
          <button
            onClick={clearAll}
            className="text-xs text-foreground-muted hover:text-foreground"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search Input */}
      <Input
        type="text"
        placeholder="Search tags..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="h-9"
      />

      {/* Tag List */}
      <div className="max-h-48 overflow-y-auto rounded-md border border-card-border bg-background">
        {filteredTags.length === 0 ? (
          <div className="p-4 text-center text-sm text-foreground-muted">
            {availableTags.length === 0 ? "No tags available" : "No matching tags"}
          </div>
        ) : (
          <div className="p-2">
            {filteredTags.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition hover:bg-background-muted ${
                    isSelected ? "font-medium text-accent" : "text-foreground"
                  }`}
                >
                  <span>#{tag}</span>
                  {isSelected && <CheckIcon className="h-4 w-4 text-accent" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Tags Summary */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
            >
              #{tag}
              <XIcon className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
