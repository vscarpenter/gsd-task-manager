"use client";

import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SWIPE_CONFIG } from "@/lib/constants";
import { TRAILING_REVEAL } from "@/lib/swipe-gesture";
import { cn } from "@/lib/utils";
import { useSwipeGesture } from "./use-swipe-gesture";

export interface SwipeAction {
  /** Visible caption under the glyph. */
  label: string;
  /** Accessible name, when the caption alone is too terse. */
  ariaLabel?: string;
  icon: LucideIcon;
  /** CSS color for the button ground. The ink is always `--paper`. */
  ground: string;
  testId: string;
  onAction: () => void;
}

type ActOn = (action: SwipeAction) => void;

interface SwipeActionRowProps {
  rowId: string;
  /** Revealed by a rightward swipe. A full swipe commits it without a tap. */
  leading: SwipeAction;
  /** Revealed by a leftward swipe, listed from the card edge outward. Tap only. */
  trailing: SwipeAction[];
  children: ReactNode;
}

/**
 * Wraps a card in touch swipe actions without touching the card's own DOM.
 *
 * The strips sit behind the card and only exist while a swipe is open; the card
 * slides over them on its own opaque ground. Clipping is applied only while open,
 * so the card's resting shadow is never cut.
 */
export function SwipeActionRow({ rowId, leading, trailing, children }: SwipeActionRowProps) {
  const { shown, dragging, close, surfaceProps } = useSwipeGesture(rowId, leading.onAction);

  const act: ActOn = (action) => {
    close();
    action.onAction();
  };

  return (
    <div
      data-testid="task-card-swipe"
      className={cn("relative rounded-md", shown !== 0 && "overflow-hidden")}
    >
      {shown > 0 ? <LeadingStrip width={shown} action={leading} onAct={act} /> : null}
      {shown < 0 ? <TrailingStrip actions={trailing} onAct={act} /> : null}
      <div
        data-testid="task-card-swipe-surface"
        // pan-y leaves vertical scrolling to the browser; horizontal moves reach us.
        className={cn(
          "relative touch-pan-y",
          dragging ? "transition-none" : "transition-transform duration-200 ease-out"
        )}
        style={{ transform: shown === 0 ? undefined : `translateX(${shown}px)` }}
        {...surfaceProps}
      >
        {children}
      </div>
    </div>
  );
}

/** Grows with the swipe so a full swipe fills the row with the action's ground. */
function LeadingStrip({ width, action, onAct }: { width: number; action: SwipeAction; onAct: ActOn }) {
  return (
    <div data-testid="swipe-leading" className="absolute inset-y-0 left-0 flex" style={{ width }}>
      <SwipeActionButton action={action} onAct={onAct} className="flex-1" />
    </div>
  );
}

/** Fixed at two buttons wide; the sliding card uncovers it. */
function TrailingStrip({ actions, onAct }: { actions: SwipeAction[]; onAct: ActOn }) {
  return (
    <div
      data-testid="swipe-trailing"
      className="absolute inset-y-0 right-0 flex"
      style={{ width: TRAILING_REVEAL }}
    >
      {actions.map((action) => (
        <SwipeActionButton
          key={action.testId}
          action={action}
          onAct={onAct}
          style={{ width: SWIPE_CONFIG.BUTTON_WIDTH }}
        />
      ))}
    </div>
  );
}

function SwipeActionButton({
  action,
  onAct,
  className,
  style,
}: {
  action: SwipeAction;
  onAct: ActOn;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = action.icon;
  return (
    <button
      type="button"
      data-testid={action.testId}
      aria-label={action.ariaLabel ?? action.label}
      onClick={() => onAct(action)}
      className={cn(
        "flex flex-col items-center justify-center gap-1 text-[11px] font-semibold leading-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--paper)]",
        className
      )}
      style={{ backgroundColor: action.ground, color: "var(--paper)", ...style }}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span>{action.label}</span>
    </button>
  );
}
