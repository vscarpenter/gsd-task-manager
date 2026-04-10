"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { PlusIcon, XIcon, TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface InlineTaskFormProps {
  onSubmit: (title: string, description: string, tags: string[]) => void;
  iconColor?: string;
  availableTags?: string[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Expandable inline form for quick task creation within a quadrant.
 * Supports title, optional description, and tags.
 * Form stays open after submission for rapid entry.
 */
export function InlineTaskForm({ onSubmit, iconColor, availableTags = [], isOpen: controlledOpen, onOpenChange }: InlineTaskFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      titleRef.current?.focus();
    }
  }, [isOpen]);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setTags([]);
    setTagInput("");
    setShowTagSuggestions(false);
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit(trimmed, description.trim(), tags);
    resetForm();
    setIsOpen(false);
  }, [title, description, tags, onSubmit, resetForm, setIsOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    resetForm();
  }, [setIsOpen, resetForm]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleClose();
    }
  }, [handleClose]);

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
    tagInputRef.current?.focus();
  }, [tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(prev => prev.slice(0, -1));
    } else if (e.key === "Escape") {
      setShowTagSuggestions(false);
    }
  }, [tagInput, tags.length, addTag]);

  const filteredSuggestions = availableTags.filter(
    t => !tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase())
  ).slice(0, 5);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border border-dashed border-border/50 px-3 py-2 text-sm text-foreground-muted",
          "transition-colors hover:border-border hover:bg-background/50 hover:text-foreground"
        )}
        aria-label="Add task to this quadrant"
      >
        <PlusIcon className={cn("h-4 w-4", iconColor)} />
        <span>Add task</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-accent/30 bg-card p-4 shadow-sm">
      {/* Title */}
      <input
        ref={titleRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleTitleKeyDown}
        placeholder="Task title..."
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        aria-label="New task title"
      />

      {/* Description */}
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape") handleClose(); }}
        placeholder="Description (optional)..."
        rows={2}
        className="mt-2 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        aria-label="Task description"
      />

      {/* Tags */}
      <div className="mt-2">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
              <TagIcon className="h-2.5 w-2.5" />
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:text-accent-hover" aria-label={`Remove tag ${tag}`}>
                <XIcon className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            ref={tagInputRef}
            type="text"
            value={tagInput}
            onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
            onKeyDown={handleTagKeyDown}
            onFocus={() => setShowTagSuggestions(true)}
            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 150)}
            placeholder={tags.length === 0 ? "Add tags..." : ""}
            className="min-w-[80px] flex-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted/60 outline-none"
            aria-label="Add tag"
          />
        </div>

        {/* Tag suggestions dropdown */}
        {showTagSuggestions && filteredSuggestions.length > 0 && (
          <div className="mt-1 rounded-lg border border-border bg-card p-1 shadow-md">
            {filteredSuggestions.map(tag => (
              <button
                key={tag}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(tag)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-background-muted transition-colors"
              >
                <TagIcon className="h-3 w-3 text-foreground-muted" />
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!title.trim()}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            title.trim()
              ? "bg-accent text-white hover:bg-accent-hover"
              : "bg-background-muted text-foreground-muted cursor-not-allowed"
          )}
        >
          Add Task
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
