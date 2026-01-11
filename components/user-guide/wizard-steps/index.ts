export { StepWelcome } from "./step-welcome";
export { StepMatrix } from "./step-matrix";
export { StepTasks } from "./step-tasks";
export { StepPowerFeatures } from "./step-power-features";
export { StepWorkflows } from "./step-workflows";
export { StepFinal } from "./step-final";

export const WIZARD_STEPS = [
  { id: 1, component: "StepWelcome", title: "Welcome" },
  { id: 2, component: "StepMatrix", title: "The Matrix" },
  { id: 3, component: "StepTasks", title: "Task Management" },
  { id: 4, component: "StepPowerFeatures", title: "Power Features" },
  { id: 5, component: "StepWorkflows", title: "Workflows" },
  { id: 6, component: "StepFinal", title: "Get Started" },
] as const;

export const TOTAL_STEPS = WIZARD_STEPS.length;
