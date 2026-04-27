"use client";

import { AppShell } from "@/components/matrix-simplified/app-shell";
import { SettingsPage } from "@/components/settings-page";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewToggle } from "@/components/view-toggle";

export default function Page() {
  return (
    <AppShell
      title="Settings"
      topbarRightSlot={
        <div className="flex items-center gap-3">
          <ViewToggle />
          <div className="h-6 w-px bg-border" />
          <ThemeToggle />
        </div>
      }
    >
      <SettingsPage />
    </AppShell>
  );
}
