"use client";

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  PaletteIcon,
  BellIcon,
  CloudIcon,
  SettingsIcon,
  ArrowRightIcon,
  SunIcon,
  MoonIcon,
  MonitorIcon,
  CheckCircleIcon
} from "lucide-react";
import { useTheme } from "next-themes";
import { useQuickSettings } from "@/lib/use-quick-settings";

interface QuickSettingsPanelProps {
  children: React.ReactNode; // Trigger button
  onOpenFullSettings: () => void;
}

/**
 * Quick Settings Panel - Slide-out from right with frequently-adjusted settings
 */
export function QuickSettingsPanel({
  children,
  onOpenFullSettings
}: QuickSettingsPanelProps) {
  const { theme, setTheme } = useTheme();
  const {
    showCompleted,
    toggleShowCompleted,
    notificationsEnabled,
    toggleNotifications,
    isSyncEnabled,
    autoSyncEnabled,
    syncInterval,
    setSyncInterval
  } = useQuickSettings();

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-80 sm:w-96 overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Quick Settings</SheetTitle>
          <SheetDescription>
            Frequently adjusted preferences
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Theme */}
          <div className="space-y-3">
            <Label className="text-base flex items-center gap-2">
              <PaletteIcon className="h-4 w-4" />
              Theme
            </Label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "primary" : "subtle"}
                className="flex-1 text-sm py-1.5"
                onClick={() => setTheme("light")}
              >
                <SunIcon className="h-4 w-4 mr-1.5" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "primary" : "subtle"}
                className="flex-1 text-sm py-1.5"
                onClick={() => setTheme("dark")}
              >
                <MoonIcon className="h-4 w-4 mr-1.5" />
                Dark
              </Button>
              <Button
                variant={theme === "system" ? "primary" : "subtle"}
                className="flex-1 text-sm py-1.5"
                onClick={() => setTheme("system")}
              >
                <MonitorIcon className="h-4 w-4 mr-1.5" />
                Auto
              </Button>
            </div>
          </div>

          {/* Show Completed */}
          <div className="flex items-center justify-between">
            <Label htmlFor="show-completed" className="text-base flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4" />
              Show completed tasks
            </Label>
            <Switch
              id="show-completed"
              checked={showCompleted}
              onCheckedChange={toggleShowCompleted}
            />
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <Label htmlFor="notifications" className="text-base flex items-center gap-2">
              <BellIcon className="h-4 w-4" />
              Notifications
            </Label>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={toggleNotifications}
            />
          </div>

          {/* Auto-sync (conditional) */}
          {isSyncEnabled && autoSyncEnabled && (
            <>
              <div className="border-t border-border pt-4" />
              <div className="space-y-3">
                <Label className="text-base flex items-center gap-2">
                  <CloudIcon className="h-4 w-4" />
                  Auto-sync interval
                </Label>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[syncInterval]}
                    onValueChange={([val]) => setSyncInterval(val)}
                    min={1}
                    max={30}
                    step={1}
                    className="flex-1"
                  />
                  <span className="text-sm font-medium w-12 text-right">
                    {syncInterval}m
                  </span>
                </div>
                <p className="text-xs text-foreground-muted">
                  Tasks sync automatically every {syncInterval} minute{syncInterval !== 1 ? 's' : ''}
                </p>
              </div>
            </>
          )}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Link to full settings */}
          <Button
            variant="subtle"
            className="w-full justify-start gap-2"
            onClick={onOpenFullSettings}
          >
            <SettingsIcon className="h-4 w-4" />
            All settings
            <ArrowRightIcon className="ml-auto h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
