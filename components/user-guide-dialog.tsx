"use client";

import { BookOpenIcon, WandSparklesIcon, ListIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGuideMode } from "@/lib/hooks/use-guide-mode";
import { WizardView } from "@/components/user-guide/wizard-view";
import { AccordionView } from "@/components/user-guide/accordion-view";

interface UserGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserGuideDialog({ open, onOpenChange }: UserGuideDialogProps) {
  const { toggleMode, isWizard } = useGuideMode("wizard");

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpenIcon className="h-5 w-5 text-accent" />
              User Guide
            </DialogTitle>

            {/* Mode toggle */}
            <ModeToggle isWizard={isWizard} onToggle={toggleMode} />
          </div>
          <DialogDescription>
            {isWizard
              ? "Step-by-step guide to mastering GSD"
              : "Quick reference for all GSD features"}
          </DialogDescription>
        </DialogHeader>

        {/* Content area - flex-1 for remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isWizard ? (
            <WizardView onComplete={handleClose} />
          ) : (
            <div className="h-full overflow-y-auto pr-1">
              <AccordionView />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ModeToggleProps {
  isWizard: boolean;
  onToggle: () => void;
}

function ModeToggle({ isWizard, onToggle }: ModeToggleProps) {
  return (
    <Button
      variant="ghost"
      onClick={onToggle}
      className="gap-2 text-sm h-8 px-3"
      aria-label={isWizard ? "Switch to reference mode" : "Switch to wizard mode"}
    >
      {isWizard ? (
        <>
          <ListIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Reference</span>
        </>
      ) : (
        <>
          <WandSparklesIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Wizard</span>
        </>
      )}
    </Button>
  );
}
