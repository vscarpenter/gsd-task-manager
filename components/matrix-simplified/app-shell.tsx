"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { CommandIcon } from "lucide-react";
import { DesktopIconRail, MobileIconRail } from "./icon-rail";
import { SimplifiedTopbar } from "./topbar";
import { HelpDrawer } from "@/components/matrix-simplified/help-drawer";
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

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
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
  children,
}: AppShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [smartViewsEnabled, setSmartViewsEnabled] = useState(false);
  const { handlers, shortcutHandlers, onSelectTask, conditions } = useShellCommandHandlers();

  useAppShortcuts({
    onSearch: openCommandPalette,
    onCapture: shortcutHandlers.onCapture,
    onReview: shortcutHandlers.onReview,
    onFocusQuadrant: shortcutHandlers.onFocusQuadrant,
  });

  useEffect(() => {
    const open = () => setHelpOpen(true);
    window.addEventListener("gsd:open-help", open);
    return () => window.removeEventListener("gsd:open-help", open);
  }, []);

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
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <SimplifiedTopbar
          title={title}
          titleAsLabel={titleAsLabel}
          caption={caption}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          searchInputRef={searchInputRef}
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
          className={cn(
            "mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 pb-20 sm:px-9 sm:py-6 md:pb-6",
            mainClassName
          )}
        >
          {children}
        </main>
        <AppFooter />
      </div>
      <MobileIconRail onHelp={() => setHelpOpen(true)} />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CommandPalette
        handlers={handlers}
        conditions={conditions}
        onSelectTask={onSelectTask}
        showSmartViews={smartViewsEnabled}
      />
    </div>
  );
}
