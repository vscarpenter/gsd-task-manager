"use client";

import { useState } from "react";
import { MailIcon, CopyIcon, Share2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { TaskRecord } from "@/lib/types";
import { TOAST_DURATION } from "@/lib/constants";
import { createLogger } from "@/lib/logger";
import {
  canUseWebShare,
  formatTaskDetails,
  isValidEmail,
} from "@/components/share-task-dialog/format-task-details";
import {
  ShareTabButtons,
  ShareTabContent,
  type ShareTab,
} from "@/components/share-task-dialog/share-tab-content";

const logger = createLogger("UI");

interface ShareTaskDialogProps {
  task: TaskRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareTaskDialog({ task, open, onOpenChange }: ShareTaskDialogProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>(() =>
    canUseWebShare() ? "native" : "email"
  );
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  if (!task) return null;

  const taskDetails = formatTaskDetails(task);
  const emailSubject = `Task: ${task.title}`;
  const emailBody = encodeURIComponent(taskDetails);

  const handleRecipientEmailChange = (email: string) => {
    setRecipientEmail(email);
    setEmailError(null);
  };

  const handleOpenEmailClient = () => {
    const trimmedEmail = recipientEmail.trim();
    if (trimmedEmail && !isValidEmail(trimmedEmail)) {
      setEmailError("Enter a valid email address, or leave it blank to pick a recipient in your mail app.");
      return;
    }

    // Percent-encode the recipient so a value like "a?cc=x@b.com" can't smuggle
    // extra mailto headers; a validated address still round-trips correctly.
    const recipient = trimmedEmail ? encodeURIComponent(trimmedEmail) : "";
    const mailto = `mailto:${recipient}?subject=${encodeURIComponent(emailSubject)}&body=${emailBody}`;

    const anchor = document.createElement("a");
    anchor.href = mailto;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    onOpenChange(false);
  };

  const handleCopyDetails = async () => {
    try {
      await navigator.clipboard.writeText(taskDetails);
      toast.success("Task details copied to clipboard", { duration: TOAST_DURATION.SHORT });
      onOpenChange(false);
    } catch {
      toast.error("Failed to copy to clipboard", { duration: TOAST_DURATION.SHORT });
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: `Task: ${task.title}`,
        text: taskDetails,
      });
      toast.success("Task shared successfully", { duration: TOAST_DURATION.SHORT });
      onOpenChange(false);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        logger.error(
          "Failed to share task",
          error instanceof Error ? error : new Error(String(error))
        );
        toast.error("Failed to share task", { duration: TOAST_DURATION.SHORT });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="share-task-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2Icon className="h-5 w-5" aria-hidden />
            Share Task: {task.title}
          </DialogTitle>
          <DialogDescription>
            {canUseWebShare()
              ? "Share this task to any app, via email, or copy to clipboard."
              : "Share this task via email or copy the details to your clipboard."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ShareTabButtons activeTab={activeTab} onTabChange={setActiveTab} />

          <ShareTabContent
            activeTab={activeTab}
            taskDetails={taskDetails}
            recipientEmail={recipientEmail}
            onRecipientEmailChange={handleRecipientEmailChange}
            emailError={emailError}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="subtle" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {activeTab === "native" ? (
              <Button onClick={handleNativeShare} className="gap-2">
                <Share2Icon className="h-4 w-4" aria-hidden />
                Share
              </Button>
            ) : activeTab === "email" ? (
              <Button onClick={handleOpenEmailClient} className="gap-2">
                <MailIcon className="h-4 w-4" aria-hidden />
                Open Email Client
              </Button>
            ) : (
              <Button onClick={handleCopyDetails} className="gap-2">
                <CopyIcon className="h-4 w-4" aria-hidden />
                Copy Details
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
