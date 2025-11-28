"use client";

import { Command } from "cmdk";
import { CommandActionItem } from "./command-item";
import type { CommandAction } from "@/lib/command-actions";

interface CommandGroupProps {
  heading: string;
  actions: CommandAction[];
  onExecute: (action: CommandAction) => void;
}

/**
 * Renders a group of command actions with a heading
 */
export function CommandGroup({ heading, actions, onExecute }: CommandGroupProps) {
  if (actions.length === 0) {
    return null;
  }

  return (
    <Command.Group
      heading={heading}
      className="px-2 py-1.5 text-xs font-semibold text-foreground-muted"
    >
      {actions.map((action) => (
        <CommandActionItem
          key={action.id}
          action={action}
          onSelect={() => onExecute(action)}
        />
      ))}
    </Command.Group>
  );
}
