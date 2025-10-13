"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  PaletteIcon,
  BellIcon,
  DatabaseIcon,
  InfoIcon,
  EyeIcon,
  EyeOffIcon,
  DownloadIcon,
  UploadIcon
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRightIcon } from "lucide-react";
import { useTasks } from "@/lib/use-tasks";
import { getNotificationSettings, updateNotificationSettings } from "@/lib/notifications";
import type { NotificationSettings } from "@/lib/types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showCompleted: boolean;
  onToggleCompleted: () => void;
  onExport: () => Promise<void>;
  onImport: (file: File) => Promise<void>;
  isLoading?: boolean;
}

export function SettingsDialog({
  open,
  onOpenChange,
  showCompleted,
  onToggleCompleted,
  onExport,
  onImport,
  isLoading
}: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const { all: tasks } = useTasks();
  const [mounted, setMounted] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);

  // Section expansion state
  const [expandedSections, setExpandedSections] = useState({
    appearance: true,
    notifications: false,
    data: false,
    about: false
  });

  useEffect(() => {
    setMounted(true);
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    const settings = await getNotificationSettings();
    setNotificationSettings(settings);
  };

  const handleNotificationToggle = async () => {
    if (!notificationSettings) return;

    const newEnabled = !notificationSettings.enabled;

    // Request permission if enabling
    if (newEnabled && "Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return; // Don't enable if permission denied
      }
    }

    await updateNotificationSettings({ enabled: newEnabled });
    await loadNotificationSettings();
  };

  const handleDefaultReminderChange = async (value: string) => {
    const minutes = parseInt(value);
    await updateNotificationSettings({ defaultReminder: minutes });
    await loadNotificationSettings();
  };

  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        await onImport(file);
        // Close settings dialog after import starts
        onOpenChange(false);
      }
    };
    input.click();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Calculate storage stats
  const activeTasks = tasks.filter(t => !t.completed).length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const estimatedSize = (JSON.stringify(tasks).length / 1024).toFixed(1);

  if (!mounted) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Appearance Section */}
          <Collapsible
            open={expandedSections.appearance}
            onOpenChange={() => toggleSection('appearance')}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
              <div className="flex items-center gap-3">
                <PaletteIcon className="h-5 w-5 text-accent" />
                <span className="font-semibold text-foreground">Appearance</span>
              </div>
              <ChevronRightIcon
                className={`h-5 w-5 text-foreground-muted transition-transform ${
                  expandedSections.appearance ? "rotate-90" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
              {/* Theme Selection */}
              <div className="space-y-2">
                <Label htmlFor="theme-select">Theme</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger id="theme-select">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-foreground-muted">
                  Choose your preferred theme. Changes apply immediately.
                </p>
              </div>

              {/* Show Completed Tasks */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {showCompleted ? (
                    <EyeIcon className="h-4 w-4 text-foreground-muted" />
                  ) : (
                    <EyeOffIcon className="h-4 w-4 text-foreground-muted" />
                  )}
                  <div>
                    <Label htmlFor="show-completed">Show completed tasks</Label>
                    <p className="text-xs text-foreground-muted">
                      Display completed tasks in the matrix view
                    </p>
                  </div>
                </div>
                <Switch
                  id="show-completed"
                  checked={showCompleted}
                  onCheckedChange={onToggleCompleted}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Notifications Section */}
          <Collapsible
            open={expandedSections.notifications}
            onOpenChange={() => toggleSection('notifications')}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
              <div className="flex items-center gap-3">
                <BellIcon className="h-5 w-5 text-accent" />
                <span className="font-semibold text-foreground">Notifications</span>
              </div>
              <ChevronRightIcon
                className={`h-5 w-5 text-foreground-muted transition-transform ${
                  expandedSections.notifications ? "rotate-90" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
              {notificationSettings && (
                <>
                  {/* Enable Notifications */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="enable-notifications">Enable browser notifications</Label>
                      <p className="text-xs text-foreground-muted">
                        Show browser notifications for task reminders
                      </p>
                    </div>
                    <Switch
                      id="enable-notifications"
                      checked={notificationSettings.enabled}
                      onCheckedChange={handleNotificationToggle}
                    />
                  </div>

                  {/* Default Reminder Time */}
                  {notificationSettings.enabled && (
                    <div className="space-y-2">
                      <Label htmlFor="default-reminder">Default reminder time</Label>
                      <Select
                        value={notificationSettings.defaultReminder.toString()}
                        onValueChange={handleDefaultReminderChange}
                      >
                        <SelectTrigger id="default-reminder">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minutes before</SelectItem>
                          <SelectItem value="30">30 minutes before</SelectItem>
                          <SelectItem value="60">1 hour before</SelectItem>
                          <SelectItem value="120">2 hours before</SelectItem>
                          <SelectItem value="1440">1 day before</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-foreground-muted">
                        Default reminder time for new tasks with due dates
                      </p>
                    </div>
                  )}

                  {/* Permission Status */}
                  {"Notification" in window && (
                    <div className="rounded-lg border border-border bg-background-muted/50 p-3">
                      <p className="text-xs text-foreground-muted">
                        Browser permission:{" "}
                        <span className="font-medium text-foreground">
                          {Notification.permission === "granted"
                            ? "Granted ✓"
                            : Notification.permission === "denied"
                            ? "Denied"
                            : "Not requested"}
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Data & Backup Section */}
          <Collapsible
            open={expandedSections.data}
            onOpenChange={() => toggleSection('data')}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
              <div className="flex items-center gap-3">
                <DatabaseIcon className="h-5 w-5 text-accent" />
                <span className="font-semibold text-foreground">Data & Backup</span>
              </div>
              <ChevronRightIcon
                className={`h-5 w-5 text-foreground-muted transition-transform ${
                  expandedSections.data ? "rotate-90" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
              {/* Storage Stats */}
              <div className="rounded-lg border border-border bg-background-muted/50 p-4">
                <h4 className="text-sm font-semibold text-foreground mb-2">Storage</h4>
                <div className="space-y-1 text-xs text-foreground-muted">
                  <p>Active tasks: <span className="font-medium text-foreground">{activeTasks}</span></p>
                  <p>Completed tasks: <span className="font-medium text-foreground">{completedTasks}</span></p>
                  <p>Total tasks: <span className="font-medium text-foreground">{tasks.length}</span></p>
                  <p>Estimated size: <span className="font-medium text-foreground">{estimatedSize} KB</span></p>
                </div>
              </div>

              {/* Export/Import Actions */}
              <div className="space-y-2">
                <Button
                  variant="subtle"
                  className="w-full justify-start"
                  onClick={onExport}
                  disabled={isLoading}
                >
                  <DownloadIcon className="mr-2 h-4 w-4" />
                  Export Tasks
                </Button>
                <Button
                  variant="subtle"
                  className="w-full justify-start"
                  onClick={handleImportClick}
                  disabled={isLoading}
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  Import Tasks
                </Button>
                <p className="text-xs text-foreground-muted px-2">
                  Export your tasks as JSON for backup or transfer. Import to restore or merge tasks.
                </p>
              </div>

              {/* Clear Data Warning */}
              <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20 p-3">
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">
                  ⚠️ Clearing data is permanent and cannot be undone. Export your tasks first.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* About Section */}
          <Collapsible
            open={expandedSections.about}
            onOpenChange={() => toggleSection('about')}
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg bg-background-muted p-4 hover:bg-background-muted/80">
              <div className="flex items-center gap-3">
                <InfoIcon className="h-5 w-5 text-accent" />
                <span className="font-semibold text-foreground">About</span>
              </div>
              <ChevronRightIcon
                className={`h-5 w-5 text-foreground-muted transition-transform ${
                  expandedSections.about ? "rotate-90" : ""
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4 pt-4 space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Version</span>
                  <span className="font-medium text-foreground">
                    {process.env.NEXT_PUBLIC_BUILD_VERSION || "3.0.1"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Build Date</span>
                  <span className="font-medium text-foreground">
                    {process.env.NEXT_PUBLIC_BUILD_DATE || "Oct 12, 2025"}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background-muted/50 p-3">
                <p className="text-xs text-foreground-muted mb-2">
                  🔒 <span className="font-semibold text-foreground">Privacy First</span>
                </p>
                <p className="text-xs text-foreground-muted">
                  All your data is stored locally in your browser. Nothing is sent to any server.
                  Your tasks, preferences, and settings stay on your device.
                </p>
              </div>

              <Button
                variant="subtle"
                className="w-full justify-start"
                onClick={() => window.open("https://github.com/vscarpenter/gsd-task-manager", "_blank")}
              >
                View on GitHub →
              </Button>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DialogContent>
    </Dialog>
  );
}
