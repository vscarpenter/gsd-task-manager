"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { IconRail } from "./icon-rail";
import { SimplifiedTopbar } from "./topbar";
import { HelpDrawer } from "@/components/matrix-simplified/help-drawer";

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
          rightSlot={topbarRightSlot}
        />
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-5 pb-20 sm:px-9 sm:py-6 md:pb-6">
          {children}
        </main>
      </div>
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
