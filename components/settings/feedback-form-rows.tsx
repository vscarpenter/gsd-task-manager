"use client";

import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  MAX_MESSAGE_LENGTH,
  type Category,
  type FeedbackPayload,
  type Sentiment,
} from "@/lib/feedback/feedback-payload";
import { SettingsRow } from "./shared-components";
import type { SendStatus } from "./use-feedback-form";

const CATEGORY_LABELS: Record<Category, string> = {
  idea: "An idea",
  praise: "Something I like",
  gripe: "Something that annoys me",
  bug: "Something's broken",
};

interface SentimentRowProps {
  sentiment: Sentiment | null;
  onChange: (next: Sentiment | null) => void;
}

/** Thumbs up / down. Pressing the active one clears it, so nothing is forced. */
export function FeedbackSentimentRow({ sentiment, onChange }: SentimentRowProps) {
  const options: { value: Sentiment; label: string; Icon: typeof ThumbsUpIcon }[] = [
    { value: "up", label: "Working for me", Icon: ThumbsUpIcon },
    { value: "down", label: "Not working for me", Icon: ThumbsDownIcon },
  ];

  return (
    <SettingsRow label="How is GSD treating you?">
      <div className="flex gap-2">
        {options.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={sentiment === value}
            onClick={() => onChange(sentiment === value ? null : value)}
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full border transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              sentiment === value
                ? "border-accent bg-accent/10 text-accent"
                : "border-border/70 text-foreground-muted hover:bg-background-muted/40",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </SettingsRow>
  );
}

interface NoteRowsProps {
  category: Category | null;
  message: string;
  onCategoryChange: (next: Category | null) => void;
  onMessageChange: (next: string) => void;
}

/** The category picker and the free-text note. */
export function FeedbackNoteRows({
  category,
  message,
  onCategoryChange,
  onMessageChange,
}: NoteRowsProps) {
  return (
    <>
      <SettingsRow label="What kind of feedback is this?">
        <select
          aria-label="What kind of feedback is this?"
          value={category ?? ""}
          onChange={(event) => onCategoryChange((event.target.value || null) as Category | null)}
          className="min-h-[44px] rounded-xl border border-border/70 bg-transparent px-3 text-sm text-foreground"
        >
          <option value="">Not sure</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
      </SettingsRow>

      <div className="px-4 py-3.5">
        <label htmlFor="feedback-message" className="text-sm font-medium text-foreground">
          Anything else you want to tell me?
        </label>
        <textarea
          id="feedback-message"
          rows={4}
          maxLength={MAX_MESSAGE_LENGTH}
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="Optional. Please don't include anything private — this arrives with no way for me to reply."
          className="mt-2 w-full rounded-2xl border border-border/70 bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="mt-1 text-right text-xs text-foreground-muted">
          {message.length} / {MAX_MESSAGE_LENGTH}
        </p>
      </div>
    </>
  );
}

/**
 * The disclosure that shows exactly what will be transmitted.
 *
 * Rendered from the same payload object the request body is serialized from,
 * so it cannot describe something other than what actually goes over the wire.
 */
export function FeedbackPayloadPreview({ payload }: { payload: FeedbackPayload | null }) {
  return (
    <details className="px-4 py-3.5">
      <summary className="cursor-pointer text-sm font-medium text-foreground marker:text-foreground-muted">
        Review exactly what will be sent
      </summary>
      <p className="mt-2 text-xs leading-relaxed text-foreground-muted">
        This is the whole message. No account, no device identifier, no task of yours.
      </p>
      <div className="mt-2 overflow-x-auto rounded-2xl bg-background-muted/50 p-3">
        <pre
          data-testid="feedback-payload-preview"
          className="text-xs leading-relaxed text-foreground"
        >
          {payload ? JSON.stringify(payload, null, 2) : ""}
        </pre>
      </div>
    </details>
  );
}

interface SendRowProps {
  canSend: boolean;
  status: SendStatus;
  lastSentAt: string | null;
  onSend: () => void;
}

export function FeedbackSendRow({ canSend, status, lastSentAt, onSend }: SendRowProps) {
  const message =
    status.kind === "error"
      ? status.message
      : status.kind === "sent"
        ? "Sent. Thank you — it genuinely helps."
        : "";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p
          role="status"
          aria-live="polite"
          className={cn("text-xs", status.kind === "error" ? "text-status-error" : "text-foreground-muted")}
        >
          {message}
        </p>
        {lastSentAt && status.kind !== "error" && (
          <p className="mt-0.5 text-xs text-foreground-muted">
            Last sent {new Date(lastSentAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <Button onClick={onSend} disabled={!canSend}>
        {status.kind === "sending" ? "Sending…" : "Send feedback"}
      </Button>
    </div>
  );
}
