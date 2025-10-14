"use client";

import { useState } from "react";
import { MailIcon, CopyIcon, Share2Icon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { TaskRecord } from "@/lib/types";
import { formatDueDate } from "@/lib/utils";

interface ShareTaskDialogProps {
  task: TaskRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShareTab = "email" | "copy";

function formatTaskDetails(task: TaskRecord): string {
  const lines: string[] = [];

  lines.push(`Task: ${task.title}`);
  lines.push("");

  if (task.description) {
    lines.push("Description:");
    lines.push(task.description);
    lines.push("");
  }

  lines.push("Details:");
  lines.push(`Status: ${task.completed ? "Completed" : "To Do"}`);
  lines.push(`Priority: ${task.urgent && task.important ? "Urgent & Important" : task.urgent ? "Urgent" : task.important ? "Important" : "Low Priority"}`);

  if (task.dueDate) {
    lines.push(`Due: ${formatDueDate(task.dueDate)}`);
  }

  if (task.tags.length > 0) {
    lines.push(`Tags: ${task.tags.join(", ")}`);
  }

  if (task.subtasks.length > 0) {
    lines.push("");
    lines.push("Subtasks:");
    task.subtasks.forEach(subtask => {
      lines.push(`  ${subtask.completed ? "☑" : "☐"} ${subtask.title}`);
    });
  }

  lines.push("");
  lines.push(`Created: ${new Date(task.createdAt).toLocaleDateString()}`);
  lines.push("");
  lines.push("Sent from GSD Task Manager");

  return lines.join("\n");
}

export function ShareTaskDialog({ task, open, onOpenChange }: ShareTaskDialogProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>("email");
  const [recipientEmail, setRecipientEmail] = useState("");
  const { showToast } = useToast();

  if (!task) {
    return null;
  }

  const taskDetails = formatTaskDetails(task);
  const emailSubject = `Task: ${task.title}`;
  const emailBody = encodeURIComponent(taskDetails);

  const handleOpenEmailClient = () => {
    const mailto = recipientEmail
      ? `mailto:${recipientEmail}?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`
      : `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`;

    // Create a temporary anchor element to trigger mailto without navigating away
    const anchor = document.createElement('a');
    anchor.href = mailto;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';

    // Trigger click and clean up
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    onOpenChange(false);
  };

  const handleCopyDetails = async () => {
    try {
      await navigator.clipboard.writeText(taskDetails);
      showToast("Task details copied to clipboard", undefined, 3000);
      onOpenChange(false);
    } catch {
      showToast("Failed to copy to clipboard", undefined, 3000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2Icon className="h-5 w-5" />
            Share Task: {task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-foreground-muted">
            Share this task via email or copy the details to your clipboard
          </p>

          {/* Tab buttons */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab("email")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "email"
                  ? "border-accent text-accent"
                  : "border-transparent text-foreground-muted hover:text-foreground"
              }`}
            >
              <MailIcon className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={() => setActiveTab("copy")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === "copy"
                  ? "border-accent text-accent"
                  : "border-transparent text-foreground-muted hover:text-foreground"
              }`}
            >
              <CopyIcon className="h-4 w-4" />
              Copy Details
            </button>
          </div>

          {/* Email tab content */}
          {activeTab === "email" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="recipient-email" className="text-sm font-medium text-foreground">
                  Recipient Email (optional)
                </label>
                <Input
                  id="recipient-email"
                  type="email"
                  placeholder="Enter email address..."
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Email Preview</label>
                <div className="rounded-md border border-border bg-background-muted p-3 max-h-64 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                    {taskDetails}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* Copy tab content */}
          {activeTab === "copy" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground">Task Details</label>
                <div className="rounded-md border border-border bg-background-muted p-3 max-h-64 overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-foreground">
                    {taskDetails}
                  </pre>
                </div>
              </div>
              <p className="text-xs text-foreground-muted">
                Click &quot;Copy Details&quot; to copy this text to your clipboard
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="subtle" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {activeTab === "email" ? (
              <Button onClick={handleOpenEmailClient} className="gap-2">
                <MailIcon className="h-4 w-4" />
                Open Email Client
              </Button>
            ) : (
              <Button onClick={handleCopyDetails} className="gap-2">
                <CopyIcon className="h-4 w-4" />
                Copy Details
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
