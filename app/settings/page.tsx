"use client";

import { AppShell } from "@/components/matrix-simplified/app-shell";
import { SettingsPage } from "@/components/settings-page";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Page() {
  return (
    <AppShell
      title="Settings"
      topbarRightSlot={<ThemeToggle />}
    >
      <SettingsPage />
    </AppShell>
  );
}
