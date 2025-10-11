"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";

interface TagAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onSelect: (tag: string) => void;
  onEnterWithoutSelection?: () => void;
  placeholder?: string;
}

/**
 * Autocomplete input for tag selection
 *
 * Features:
 * - Dropdown shows filtered suggestions based on input
 * - Keyboard navigation (arrow keys, Enter, Escape)
 * - Click to select
 * - Accessible with ARIA attributes
 */
export function TagAutocompleteInput({
  value,
  onChange,
  suggestions,
  onSelect,
  onEnterWithoutSelection,
  placeholder
}: TagAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter suggestions based on current input
  const filteredSuggestions = value.trim()
    ? suggestions
        .filter((tag) => tag.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 8) // Limit to 8 suggestions
    : [];

  const showDropdown = isOpen && filteredSuggestions.length > 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlighted index when suggestions change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [filteredSuggestions.length, value]);

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelectSuggestion = (tag: string) => {
    onSelect(tag);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      // If dropdown is closed and user types, open it
      if (event.key !== "Enter" && event.key !== "Escape") {
        setIsOpen(true);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;

      case "ArrowUp":
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case "Enter":
        event.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
          handleSelectSuggestion(filteredSuggestions[highlightedIndex]);
        } else if (onEnterWithoutSelection) {
          // If no suggestion is highlighted, let the parent handle Enter (manual add)
          onEnterWithoutSelection();
        }
        break;

      case "Escape":
        event.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;

      case "Tab":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  return (
    <div className="relative flex-1">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="tag-suggestions"
        aria-autocomplete="list"
        aria-activedescendant={
          highlightedIndex >= 0 ? `tag-suggestion-${highlightedIndex}` : undefined
        }
      />

      {showDropdown && (
        <div
          ref={dropdownRef}
          id="tag-suggestions"
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg"
        >
          <ul className="max-h-60 overflow-auto py-1">
            {filteredSuggestions.map((tag, index) => (
              <li
                key={tag}
                id={`tag-suggestion-${index}`}
                role="option"
                aria-selected={index === highlightedIndex}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  index === highlightedIndex
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50"
                }`}
                onClick={() => handleSelectSuggestion(tag)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
