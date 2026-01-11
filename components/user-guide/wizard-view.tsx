"use client";

import { useState, useCallback } from "react";
import { WizardContainer } from "./wizard-container";
import {
  StepWelcome,
  StepMatrix,
  StepTasks,
  StepPowerFeatures,
  StepWorkflows,
  StepFinal,
  TOTAL_STEPS,
} from "./wizard-steps";

interface WizardViewProps {
  onComplete: () => void;
}

/**
 * Wizard-style view for the user guide
 * Guides users through 6 steps with navigation controls
 */
export function WizardView({ onComplete }: WizardViewProps) {
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <StepWelcome />;
      case 2:
        return <StepMatrix />;
      case 3:
        return <StepTasks />;
      case 4:
        return <StepPowerFeatures />;
      case 5:
        return <StepWorkflows />;
      case 6:
        return <StepFinal />;
      default:
        return <StepWelcome />;
    }
  };

  return (
    <WizardContainer
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      onNext={handleNext}
      onPrevious={handlePrevious}
      onSkip={onComplete}
    >
      {renderStep()}
    </WizardContainer>
  );
}
