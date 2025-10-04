"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>Get into flow without leaving the keyboard.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-200">
          <Shortcut label="Create task" hint="Press N" />
          <Shortcut label="Focus search" hint="Press /" />
          <Shortcut label="Open this help" hint="Press ?" />
          <Shortcut label="Toggle theme" hint="Press T" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ShortcutProps {
  label: string;
  hint: string;
}

function Shortcut({ label, hint }: ShortcutProps) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
      <span>{label}</span>
      <span className="text-xs uppercase tracking-wide text-slate-400">{hint}</span>
    </div>
  );
}
