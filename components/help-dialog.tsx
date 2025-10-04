"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LightbulbIcon, KeyboardIcon } from "lucide-react";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Help & Tips</DialogTitle>
          <DialogDescription>Get the most out of GSD Task Manager</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tips Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <LightbulbIcon className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-slate-900">Quick Tips</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <Tip text="Tasks are automatically organized by urgency and importance into four quadrants" />
              <Tip text="Focus on 'Do First' (urgent + important) tasks to tackle high-priority items" />
              <Tip text="Use 'Schedule' (not urgent + important) for strategic planning and growth" />
              <Tip text="Delegate or eliminate tasks that don't align with your goals" />
              <Tip text="All data is stored locally in your browser - export regularly to back up" />
              <Tip text="Install as a PWA to use offline and get a native app experience" />
            </div>
          </section>

          {/* Keyboard Shortcuts Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <KeyboardIcon className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-slate-900">Keyboard Shortcuts</h3>
            </div>
            <div className="space-y-2">
              <Shortcut label="Create new task" hint="N" />
              <Shortcut label="Focus search" hint="/" />
              <Shortcut label="Toggle theme" hint="T" />
              <Shortcut label="Show this help" hint="?" />
            </div>
          </section>

          {/* Eisenhower Matrix Section */}
          <section>
            <h3 className="mb-3 font-semibold text-slate-900">The Eisenhower Matrix</h3>
            <div className="space-y-2 text-sm">
              <QuadrantInfo
                title="Do First"
                color="bg-blue-100 text-blue-700"
                description="Urgent + Important: Critical tasks requiring immediate attention"
              />
              <QuadrantInfo
                title="Schedule"
                color="bg-yellow-100 text-yellow-700"
                description="Not Urgent + Important: Strategic tasks for long-term success"
              />
              <QuadrantInfo
                title="Delegate"
                color="bg-green-100 text-green-700"
                description="Urgent + Not Important: Tasks others can handle"
              />
              <QuadrantInfo
                title="Eliminate"
                color="bg-purple-100 text-purple-700"
                description="Not Urgent + Not Important: Low-value tasks to minimize"
              />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface TipProps {
  text: string;
}

function Tip({ text }: TipProps) {
  return (
    <div className="flex gap-2">
      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
      <p>{text}</p>
    </div>
  );
}

interface ShortcutProps {
  label: string;
  hint: string;
}

function Shortcut({ label, hint }: ShortcutProps) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-700">{label}</span>
      <kbd className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-mono text-slate-600">
        {hint}
      </kbd>
    </div>
  );
}

interface QuadrantInfoProps {
  title: string;
  color: string;
  description: string;
}

function QuadrantInfo({ title, color, description }: QuadrantInfoProps) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${color}`}>
          {title}
        </span>
      </div>
      <p className="text-xs text-slate-600">{description}</p>
    </div>
  );
}
