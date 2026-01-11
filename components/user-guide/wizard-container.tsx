"use client";

import { useCallback, useEffect } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/ui/progress";

interface WizardContainerProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  children: React.ReactNode;
}

/**
 * Container for wizard-style step navigation
 * Includes progress indicator, content area, and navigation buttons
 */
export function WizardContainer({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  onSkip,
  children,
}: WizardContainerProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" && !isFirstStep) {
        onPrevious();
      } else if (event.key === "ArrowRight" && !isLastStep) {
        onNext();
      } else if (event.key === "Enter" && isLastStep) {
        onSkip();
      }
    },
    [isFirstStep, isLastStep, onNext, onPrevious, onSkip]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-full">
      {/* Progress indicator */}
      <div className="flex-shrink-0 pb-4 border-b border-border">
        <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
      </div>

      {/* Content area - scrollable */}
      <div className="flex-1 overflow-y-auto py-6 min-h-0">
        {children}
      </div>

      {/* Navigation footer */}
      <div className="flex-shrink-0 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          {/* Previous button */}
          <Button
            variant="ghost"
            onClick={onPrevious}
            disabled={isFirstStep}
            className="gap-1"
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </Button>

          {/* Skip button */}
          <Button variant="ghost" onClick={onSkip} className="gap-1">
            <XIcon className="h-4 w-4" />
            Skip
          </Button>

          {/* Next/Finish button */}
          <Button onClick={isLastStep ? onSkip : onNext} className="gap-1">
            {isLastStep ? "Finish" : "Next"}
            {!isLastStep && <ChevronRightIcon className="h-4 w-4" />}
          </Button>
        </div>

        {/* Keyboard hint */}
        <p className="text-center text-xs text-foreground-muted mt-2">
          Use <kbd className="px-1 py-0.5 bg-background-muted rounded text-xs">←</kbd>{" "}
          <kbd className="px-1 py-0.5 bg-background-muted rounded text-xs">→</kbd> to navigate
        </p>
      </div>
    </div>
  );
}
