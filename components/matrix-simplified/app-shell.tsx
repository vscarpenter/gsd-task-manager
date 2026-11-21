"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { CommandIcon } from "lucide-react";
import { DesktopIconRail, MobileIconRail } from "./icon-rail";
import { SimplifiedTopbar } from "./topbar";
import { usePinnedStageFit } from "./use-pinned-stage-fit";
import dynamic from "next/dynamic";
import { AppFooter } from "@/components/app-footer";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  APP_PREFERENCES_EVENT,
  getAppPreferences,
  type AppPreferencesEventDetail,
} from "@/lib/smart-views";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/use-command-palette";
import { useShellCommandHandlers } from "@/lib/use-shell-command-handlers";
import { useAppShortcuts } from "@/lib/use-app-shortcuts";
import { cn } from "@/lib/utils";

/**
 * Classes that pin the shell to the viewport when `fillViewport` is set, the
 * screen is wide and tall enough for it (the `pinned` variant in globals.css),
 * and the stage gets at least 10rem (usePinnedStageFit). main is a flex column
 * from md either way, so the stage's predicted height holds in both states.
 * main needs min-h-0! because globals.css sets `main { min-height: calc(100vh -
 * 3.5rem) }` outside any layer, which outranks a layered utility and would push
 * the footer below the fold.
 */
const MAIN_CLASS = "mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 pb-20 sm:px-9 sm:py-6 md:pb-6";
/**
 * Below md the rail, and the capture dock when a page has one, sit fixed over
 * the bottom of the page. --fixed-chrome-bottom is their height. It pads the
 * column so the page can scroll its end clear of them, and globals.css uses it
 * as the scroll margin that keeps a focused control from landing under them.
 */
const COLUMN_CLASS =
  "flex min-w-0 flex-1 flex-col [--fixed-chrome-bottom:calc(3.75rem+env(safe-area-inset-bottom))] max-md:has-[[data-testid=mobile-capture-dock]]:[--fixed-chrome-bottom:calc(10.25rem+env(safe-area-inset-bottom))] pb-(--fixed-chrome-bottom) md:pb-0";
const FILL_VIEWPORT_COLUMN = "pinned:h-dvh pinned:overflow-hidden";
const FILL_VIEWPORT_MAIN = "md:flex md:flex-col pinned:min-h-0! pinned:overflow-hidden";
const HelpDrawer = dynamic(() => import('./help-drawer').then((module) => module.HelpDrawer));

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

/** The help drawer's open state. A "gsd:open-help" window event opens it too. */
function useHelpDrawerOpen(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("gsd:open-help", show);
    return () => window.removeEventListener("gsd:open-help", show);
  }, []);
  return [open, setOpen];
}

interface AppShellProps {
  title: string;
  /** Render the compact topbar title as a label when page content owns the h1. */
  titleAsLabel?: boolean;
  caption?: ReactNode;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  topbarRightSlot?: ReactNode;
  mainClassName?: string;
  /** Tuck the topbar away on scroll-down at compact widths. The matrix opts in. */
  quietChromeOnScroll?: boolean;
  /**
   * Pin the shell to the viewport where the `pinned` variant holds (md and up,
   * with a height floor; see globals.css) and the stage would get at least
   * 10rem (usePinnedStageFit), and hand the remaining height to the
   * page as a flex column, so a child can scroll internally instead of the
   * page. The matrix opts in; every other route keeps page scroll. Compact
   * widths are untouched either way.
   */
  fillViewport?: boolean;
  children: ReactNode;
}

export function AppShell({
  title,
  titleAsLabel = false,
  caption,
  searchQuery,
  onSearchChange,
  searchInputRef,
  topbarRightSlot,
  mainClassName,
  quietChromeOnScroll = false,
  fillViewport = false,
  children,
}: AppShellProps) {
  const [helpOpen, setHelpOpen] = useHelpDrawerOpen();
  const columnRef = useRef<HTMLDivElement>(null);
  usePinnedStageFit(columnRef, fillViewport);
  const [smartViewsEnabled, setSmartViewsEnabled] = useState(false);
  const { handlers, shortcutHandlers, onSelectTask, conditions } = useShellCommandHandlers();

  useAppShortcuts({
    onSearch: openCommandPalette,
    onCapture: shortcutHandlers.onCapture,
    onReview: shortcutHandlers.onReview,
    onFocusQuadrant: shortcutHandlers.onFocusQuadrant,
  });

  useEffect(() => {
    let cancelled = false;

    getAppPreferences()
      .then((preferences) => {
        if (!cancelled) {
          setSmartViewsEnabled(preferences.smartViewsEnabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSmartViewsEnabled(false);
        }
      });

    const onPreferencesChange = (event: Event) => {
      const preferences = (event as CustomEvent<AppPreferencesEventDetail>).detail?.preferences;
      if (preferences) {
        setSmartViewsEnabled(preferences.smartViewsEnabled);
      }
    };

    window.addEventListener(APP_PREFERENCES_EVENT, onPreferencesChange);
    return () => {
      cancelled = true;
      window.removeEventListener(APP_PREFERENCES_EVENT, onPreferencesChange);
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <a
        href="#main-content"
        className="touch-target fixed left-[max(1rem,env(safe-area-inset-left))] top-[max(1rem,env(safe-area-inset-top))] z-[100] inline-flex -translate-y-24 items-center rounded-sm bg-accent px-4 py-2 text-small font-semibold text-on-accent transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <DesktopIconRail onHelp={() => setHelpOpen(true)} />
      <div ref={columnRef} className={cn(COLUMN_CLASS, fillViewport && FILL_VIEWPORT_COLUMN)}>
        <SimplifiedTopbar
          title={title} titleAsLabel={titleAsLabel} caption={caption}
          searchQuery={searchQuery} onSearchChange={onSearchChange} searchInputRef={searchInputRef}
          quietOnScroll={quietChromeOnScroll}
          rightSlot={
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="subtle"
                    className="touch-target h-10 w-10 p-0"
                    aria-label="Open command palette"
                    onClick={(event) => {
                      // Safari does not focus buttons on pointer click by
                      // default. Make the visual trigger the explicit return
                      // target before the event-driven palette opens.
                      event.currentTarget.focus();
                      openCommandPalette();
                    }}
                  >
                    <CommandIcon className="h-4 w-4" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Command Palette</p>
                </TooltipContent>
              </Tooltip>
              {topbarRightSlot}
            </div>
          }
        />
        <main
          id="main-content"
          tabIndex={-1}
          className={cn(MAIN_CLASS, fillViewport && FILL_VIEWPORT_MAIN, mainClassName)}
        >
          {children}
        </main>
        <AppFooter />
      </div>
      <MobileIconRail onHelp={() => setHelpOpen(true)} />
      {helpOpen ? <HelpDrawer open onClose={() => setHelpOpen(false)} /> : null}
      <CommandPalette
        handlers={handlers}
        conditions={conditions}
        onSelectTask={onSelectTask}
        showSmartViews={smartViewsEnabled}
      />
    </div>
  );
}
