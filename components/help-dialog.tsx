"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LightbulbIcon, KeyboardIcon, RepeatIcon, TagIcon, CheckSquareIcon, CalendarIcon, SparklesIcon, StarIcon } from "lucide-react";

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
          <DialogDescription>Master GSD Task Manager and boost your productivity</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Keyboard Shortcuts Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <KeyboardIcon className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-foreground">Keyboard Shortcuts</h3>
            </div>
            <div className="space-y-2">
              <Shortcut label="Create new task" hint="N" />
              <Shortcut label="Focus search" hint="/" />
              <Shortcut label="Show this help" hint="?" />
            </div>
          </section>

          {/* New Features Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-foreground">Enhanced Features</h3>
            </div>
            <div className="space-y-3 text-sm">
              <FeatureBox
                icon={<StarIcon className="h-4 w-4" />}
                title="Smart Views"
                description="Pre-configured filters for common workflows like 'Today's Focus', 'This Week', and 'Overdue Backlog'. Access via the Smart Views dropdown in the header, or create custom views from your own filter combinations."
                tip="Use Smart Views to quickly focus on what matters most right now!"
              />
              <FeatureBox
                icon={<RepeatIcon className="h-4 w-4" />}
                title="Recurring Tasks"
                description="Set tasks to repeat daily, weekly, or monthly. When you complete a recurring task, a new instance is automatically created with the next due date."
                tip="Perfect for habits, routines, and regular reviews!"
              />
              <FeatureBox
                icon={<TagIcon className="h-4 w-4" />}
                title="Tags & Labels"
                description="Add multiple tags to categorize tasks (e.g., #work, #personal, #health). Tags are searchable and help you filter related tasks quickly."
                tip="Use tags to group tasks by project, context, or energy level."
              />
              <FeatureBox
                icon={<CheckSquareIcon className="h-4 w-4" />}
                title="Subtasks & Checklists"
                description="Break down complex tasks into smaller, actionable steps. Track progress with a visual progress bar showing completed/total subtasks."
                tip="Subtasks make big tasks less overwhelming and more achievable."
              />
              <FeatureBox
                icon={<CalendarIcon className="h-4 w-4" />}
                title="Smart Due Dates"
                description="Tasks display overdue warnings (red) for past-due items and due today alerts (amber) for immediate tasks. Visual cues help you prioritize time-sensitive work."
                tip="Set due dates for Q1 tasks and use them to track deadlines."
              />
            </div>
          </section>

          {/* Eisenhower Matrix Section */}
          <section>
            <h3 className="mb-3 font-semibold text-foreground">The Eisenhower Matrix</h3>
            <div className="space-y-2 text-sm">
              <QuadrantInfo
                title="Do First (Q1)"
                color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                description="Urgent + Important: Crises, deadlines, emergencies"
                examples="Client deadline today, system outage, urgent bug fix"
              />
              <QuadrantInfo
                title="Schedule (Q2)"
                color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                description="Not Urgent + Important: Strategic work, planning, growth"
                examples="Long-term projects, learning, relationship building, exercise"
              />
              <QuadrantInfo
                title="Delegate (Q3)"
                color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                description="Urgent + Not Important: Interruptions, busy work"
                examples="Some emails, meetings, routine tasks that others can handle"
              />
              <QuadrantInfo
                title="Eliminate (Q4)"
                color="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                description="Not Urgent + Not Important: Time-wasters, distractions"
                examples="Mindless scrolling, excessive TV, unnecessary meetings"
              />
            </div>
          </section>

          {/* Best Practices Section */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <LightbulbIcon className="h-4 w-4 text-accent" />
              <h3 className="font-semibold text-foreground">Best Practices</h3>
            </div>
            <div className="space-y-2 text-sm text-foreground-muted">
              <Tip text="Start each day working on Q2 tasks before Q1 fires break out" />
              <Tip text="Aim to spend 60% of your time in Q2 (Schedule) for long-term success" />
              <Tip text="Use the 2-minute rule: if a task takes < 2 minutes, do it immediately" />
              <Tip text="Review your matrix weekly - move tasks as priorities change" />
              <Tip text="Challenge Q1 tasks: are they truly urgent AND important?" />
              <Tip text="Set recurring tasks for weekly reviews and planning sessions" />
              <Tip text="Use tags to group related tasks across quadrants" />
              <Tip text="Break large Q2 projects into smaller subtasks for momentum" />
              <Tip text="Export your tasks regularly as a backup" />
              <Tip text="All data is stored locally - nothing sent to servers" />
            </div>
          </section>

          {/* Mobile Tips Section */}
          <section className="rounded-lg border border-accent/20 bg-accent/5 p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Mobile Tips</h3>
            <div className="space-y-1 text-xs text-foreground-muted">
              <Tip text="Use the blue + button for quick task creation" />
              <Tip text="Action buttons are always visible - no need to hover" />
              <Tip text="Task forms slide up from bottom for easy one-handed use" />
              <Tip text="Install as PWA for offline access and faster loading" />
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
    <div className="flex items-center justify-between rounded-lg bg-background-muted px-3 py-2 text-sm">
      <span className="text-foreground">{label}</span>
      <kbd className="rounded border border-border bg-background px-2 py-1 text-xs font-mono text-foreground-muted">
        {hint}
      </kbd>
    </div>
  );
}

interface QuadrantInfoProps {
  title: string;
  color: string;
  description: string;
  examples?: string;
}

function QuadrantInfo({ title, color, description, examples }: QuadrantInfoProps) {
  return (
    <div className="rounded-lg border border-card-border p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-xs font-semibold ${color}`}>
          {title}
        </span>
      </div>
      <p className="text-xs text-foreground-muted">{description}</p>
      {examples && (
        <p className="mt-1 text-xs italic text-foreground-muted/70">
          Examples: {examples}
        </p>
      )}
    </div>
  );
}

interface FeatureBoxProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  tip: string;
}

function FeatureBox({ icon, title, description, tip }: FeatureBoxProps) {
  return (
    <div className="rounded-lg border border-card-border bg-background-muted/50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <div className="text-accent">{icon}</div>
        <h4 className="font-semibold text-foreground">{title}</h4>
      </div>
      <p className="mb-2 text-xs text-foreground-muted">{description}</p>
      <p className="text-xs font-medium text-accent">💡 {tip}</p>
    </div>
  );
}
