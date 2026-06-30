"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { CommandIcon } from "lucide-react";
import { IconRail } from "./icon-rail";
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

function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
}

interface AppShellProps {
  title: string;
  caption?: ReactNode;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  topbarRightSlot?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  title,
  caption,
  searchQuery,
  onSearchChange,
  searchInputRef,
  topbarRightSlot,
  children,
}: AppShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const [smartViewsEnabled, setSmartViewsEnabled] = useState(false);
  const { handlers, onSelectTask, conditions } = useShellCommandHandlers();

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
      <IconRail onHelp={() => setHelpOpen(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <SimplifiedTopbar
          title={title}
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
                    className="h-10 w-10 p-0"
                    aria-label="Open command palette"
                    onClick={openCommandPalette}
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
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 pb-20 sm:px-9 sm:py-6 md:pb-6">
          {children}
        </main>
        <AppFooter />
      </div>
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
