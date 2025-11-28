"use client";

import { Command } from "cmdk";
import { cn } from "@/lib/utils";
import type { CommandAction } from "@/lib/command-actions";

interface CommandActionItemProps {
  action: CommandAction;
  onSelect: () => void;
}

/**
 * Renders a single command action item with optional keyboard shortcut
 */
export function CommandActionItem({ action, onSelect }: CommandActionItemProps) {
  return (
    <Command.Item
      key={action.id}
      value={`${action.label} ${action.keywords.join(" ")}`}
      onSelect={onSelect}
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none",
        "hover:bg-accent/10 data-[selected]:bg-accent/10"
      )}
    >
      <span className="text-foreground">{action.label}</span>
      {action.shortcut && <ShortcutDisplay keys={action.shortcut} />}
    </Command.Item>
  );
}

interface ShortcutDisplayProps {
  keys: string[];
}

/**
 * Renders keyboard shortcut keys
 */
export function ShortcutDisplay({ keys }: ShortcutDisplayProps) {
  return (
    <div className="ml-auto flex items-center gap-1">
      {keys.map((key, i) => (
        <kbd
          key={i}
          className="inline-flex h-5 items-center rounded border border-border bg-background px-1.5 text-[10px] font-medium text-foreground-muted"
        >
          {key}
        </kbd>
      ))}
    </div>
  );
}
