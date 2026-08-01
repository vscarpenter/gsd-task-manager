export type DesignDirectionSlug =
  | "refined-evolution"
  | "editorial-planner"
  | "precision-utility"
  | "spatial-focus"
  | "native-calm";

export type DesignQuadrantId = "q1" | "q2" | "q3" | "q4";
export type DueTone = "overdue" | "today" | "upcoming";

export interface DesignPalette {
  canvas: string;
  surface: string;
  raised: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  focus: string;
  line: string;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

export interface DesignDirection {
  slug: DesignDirectionSlug;
  name: string;
  index: string;
  thesis: string;
  character: string;
  typeStrategy: string;
  navigationModel: string;
  matrixModel: string;
  captureModel: string;
  mobileModel: string;
  signature: string;
  density: number;
  variance: number;
  light: DesignPalette;
  dark: DesignPalette;
}

export interface DesignTask {
  id: string;
  title: string;
  description: string;
  quadrant: DesignQuadrantId;
  tags: string[];
  dueLabel?: string;
  dueTone?: DueTone;
  recurrence?: string;
  subtasks?: { completed: number; total: number };
  dependency?: string;
  completed: boolean;
}

export interface DesignQuadrant {
  id: DesignQuadrantId;
  title: string;
  axis: string;
  prompt: string;
}

export const DESIGN_QUADRANTS: readonly DesignQuadrant[] = [
  { id: "q1", title: "Do First", axis: "Urgent · Important", prompt: "What needs action now?" },
  { id: "q2", title: "Schedule", axis: "Important · Not urgent", prompt: "What deserves protected time?" },
  { id: "q3", title: "Delegate", axis: "Urgent · Not important", prompt: "What can move through someone else?" },
  { id: "q4", title: "Eliminate", axis: "Not urgent · Not important", prompt: "What can leave the list?" },
] as const;

export const DESIGN_TASKS: readonly DesignTask[] = [
  {
    id: "renewal",
    title: "Submit renewal packet to the insurer",
    description: "Send the signed forms and coverage worksheet before the grace period closes.",
    quadrant: "q1",
    tags: ["home", "finance"],
    dueLabel: "2 days overdue",
    dueTone: "overdue",
    completed: false,
  },
  {
    id: "export-regression",
    title: "Fix the production export regression before the board review starts",
    description: "Confirm the downloaded archive opens and retains task dependencies.",
    quadrant: "q1",
    tags: ["work", "release"],
    dueLabel: "Due today · 11:30 AM",
    dueTone: "today",
    dependency: "Regression test suite",
    completed: false,
  },
  {
    id: "pediatrician",
    title: "Call the pediatrician",
    description: "Ask whether the follow-up appointment should move earlier.",
    quadrant: "q1",
    tags: ["family"],
    dueLabel: "Due today",
    dueTone: "today",
    completed: false,
  },
  {
    id: "learning-plan",
    title: "Draft the 2027 learning plan and protect two weekly deep-work blocks",
    description: "Turn the long list of topics into a deliberate quarterly sequence.",
    quadrant: "q2",
    tags: ["growth", "planning"],
    dueLabel: "Friday",
    dueTone: "upcoming",
    subtasks: { completed: 2, total: 5 },
    completed: false,
  },
  {
    id: "backup-plan",
    title: "Review household backup and recovery plan",
    description: "Verify the offline copy, recovery key, and restore instructions.",
    quadrant: "q2",
    tags: ["privacy", "home"],
    dueLabel: "Aug 8",
    dueTone: "upcoming",
    recurrence: "Monthly",
    completed: false,
  },
  {
    id: "weekly-review",
    title: "Complete the weekly planning review",
    description: "Close loose ends and reserve next week’s Q2 time.",
    quadrant: "q2",
    tags: ["planning"],
    recurrence: "Weekly",
    completed: true,
  },
  {
    id: "vendor-checklist",
    title: "Send the vendor access checklist to Maya",
    description: "Maya can complete the remaining account setup once the list lands.",
    quadrant: "q3",
    tags: ["work", "waiting"],
    dependency: "Security approval",
    completed: false,
  },
  {
    id: "catering",
    title: "Approve catering headcount",
    description: "Confirm the final number with Operations.",
    quadrant: "q3",
    tags: ["work"],
    dueLabel: "Due today · 3:00 PM",
    dueTone: "today",
    completed: false,
  },
  {
    id: "parking",
    title: "Forward parking details to guests",
    description: "Use the venue’s final arrival instructions.",
    quadrant: "q3",
    tags: ["personal"],
    dueLabel: "Tomorrow",
    dueTone: "upcoming",
    completed: false,
  },
  {
    id: "digests",
    title: "Unsubscribe from unused research digests",
    description: "Keep only the two newsletters that regularly change a decision.",
    quadrant: "q4",
    tags: ["cleanup"],
    completed: true,
  },
  {
    id: "screenshots",
    title: "Reorganize archived screenshots",
    description: "Low-value cleanup that can wait for an idle moment.",
    quadrant: "q4",
    tags: ["cleanup"],
    completed: false,
  },
  {
    id: "cable-labels",
    title: "Compare desk-cable labels",
    description: "A nice-to-have with no current consequence.",
    quadrant: "q4",
    tags: [],
    completed: false,
  },
] as const;

export const DESIGN_DIRECTIONS: readonly DesignDirection[] = [
  {
    slug: "refined-evolution",
    name: "Refined Evolution",
    index: "01",
    thesis: "Make Violet Frost quieter, clearer, and faster without breaking recognition.",
    character: "Familiar, deliberate, assured",
    typeStrategy: "Albert Sans, recalibrated hierarchy",
    navigationModel: "Top bar plus compact context rail",
    matrixModel: "Balanced floating 2 × 2 panes",
    captureModel: "Persistent natural-language capture",
    mobileModel: "Single-column panes with retained search and view switching",
    signature: "A Q2-first planning cue beside the matrix title",
    density: 6,
    variance: 4,
    light: {
      canvas: "#F3F3F7", surface: "#FDFDFF", raised: "#F7F7FA", text: "#242331",
      muted: "#646477", accent: "#5C4F7D", accentText: "#FDFDFF", focus: "#5C4F7D",
      line: "#8D8C9D", q1: "#B95F5A", q2: "#4D7A72", q3: "#A17D37", q4: "#7A7D8E",
    },
    dark: {
      canvas: "#14131B", surface: "#211F2B", raised: "#191821", text: "#ECEAF2",
      muted: "#AAA6B8", accent: "#A99BCB", accentText: "#14131B", focus: "#BBAFDA",
      line: "#6F6B80", q1: "#D88C86", q2: "#83B2A8", q3: "#D0AF68", q4: "#A5A7B8",
    },
  },
  {
    slug: "editorial-planner",
    name: "Editorial Planner",
    index: "02",
    thesis: "Turn prioritization into a thoughtful weekly planning ritual with editorial pacing.",
    character: "Warm, reflective, grounded",
    typeStrategy: "Newsreader with Albert Sans utility text",
    navigationModel: "Sticky folio header with a matrix and review switch",
    matrixModel: "Four planning chapters in reading order",
    captureModel: "Margin-note composer that expands in place",
    mobileModel: "Single-column daybook with inline margin capture",
    signature: "A weekly intention margin that keeps Q2 visible",
    density: 4,
    variance: 7,
    light: {
      canvas: "#F5F3EF", surface: "#FFFDFC", raised: "#ECE7E1", text: "#241F1C",
      muted: "#655D57", accent: "#7A342F", accentText: "#FFFDFC", focus: "#7A342F",
      line: "#867B71", q1: "#9D433D", q2: "#35695E", q3: "#7E612A", q4: "#625E67",
    },
    dark: {
      canvas: "#191614", surface: "#24201D", raised: "#302A25", text: "#F4EFE8",
      muted: "#BDB3A8", accent: "#D78B7C", accentText: "#231412", focus: "#E59A89",
      line: "#756B62", q1: "#D78B7C", q2: "#87B7A8", q3: "#C8A86A", q4: "#A9A3AF",
    },
  },
  {
    slug: "precision-utility",
    name: "Precision Utility",
    index: "03",
    thesis: "Compress the matrix into a keyboard-first operating surface with exact status cues.",
    character: "Crisp, direct, disciplined",
    typeStrategy: "IBM Plex Sans with IBM Plex Mono data",
    navigationModel: "Command rail with numbered destinations",
    matrixModel: "Dense work queues on a shared grid",
    captureModel: "Command-line capture with explicit quadrant keys",
    mobileModel: "Filterable priority table with row actions",
    signature: "A persistent shortcut ledger that doubles as orientation",
    density: 9,
    variance: 5,
    light: {
      canvas: "#F2F3F3", surface: "#FFFFFF", raised: "#E7E9EA", text: "#171A1C",
      muted: "#51585C", accent: "#A6380F", accentText: "#FFFFFF", focus: "#A6380F",
      line: "#71787B", q1: "#A6380F", q2: "#2D665D", q3: "#765B18", q4: "#565D61",
    },
    dark: {
      canvas: "#101213", surface: "#181B1D", raised: "#24282A", text: "#F2F4F5",
      muted: "#B2B7BA", accent: "#FF8A5B", accentText: "#211007", focus: "#FF9D77",
      line: "#697074", q1: "#FF8A5B", q2: "#73B7A8", q3: "#D1B15A", q4: "#A8B0B4",
    },
  },
  {
    slug: "spatial-focus",
    name: "Spatial Focus",
    index: "04",
    thesis: "Let one priority field dominate while the other quadrants remain spatially legible.",
    character: "Immersive, calm, intentional",
    typeStrategy: "Manrope with broad, low-noise hierarchy",
    navigationModel: "Priority constellation around a central workspace",
    matrixModel: "One expanded quadrant plus three orbiting summaries",
    captureModel: "Context-aware capture into the active priority",
    mobileModel: "Swipe-free focus deck with explicit adjacent priorities",
    signature: "A spatial priority map that makes Q2 feel consequential",
    density: 3,
    variance: 9,
    light: {
      canvas: "#EEF3F1", surface: "#FAFCFB", raised: "#DCE8E4", text: "#132C29",
      muted: "#4D6763", accent: "#1D675F", accentText: "#FFFFFF", focus: "#1D675F",
      line: "#718984", q1: "#A14D48", q2: "#1D675F", q3: "#806326", q4: "#5F6967",
    },
    dark: {
      canvas: "#0B1817", surface: "#122322", raised: "#1A302D", text: "#E9F4F1",
      muted: "#A9C0BA", accent: "#74C8B8", accentText: "#0B1A17", focus: "#89D8C9",
      line: "#51726B", q1: "#D78D86", q2: "#74C8B8", q3: "#D0B36C", q4: "#A8B7B3",
    },
  },
  {
    slug: "native-calm",
    name: "Native Calm",
    index: "05",
    thesis: "Use familiar platform patterns and subtle depth to make GSD feel immediately at home.",
    character: "Comfortable, polished, dependable",
    typeStrategy: "System UI with platform-native numeric forms",
    navigationModel: "Sidebar, segmented toolbar, and mobile bottom bar",
    matrixModel: "Source list with adaptive list-detail priority groups",
    captureModel: "Persistent bottom composer with inspector editing",
    mobileModel: "Bottom navigation and thumb-zone quick capture",
    signature: "A persistent list-detail inspector that never loses context",
    density: 6,
    variance: 4,
    light: {
      canvas: "#F2F2F4", surface: "#FFFFFF", raised: "#E7E7EA", text: "#1C1C1E",
      muted: "#5A5E63", accent: "#35607E", accentText: "#FFFFFF", focus: "#35607E",
      line: "#8E8E93", q1: "#A94742", q2: "#356F65", q3: "#80641F", q4: "#62656E",
    },
    dark: {
      canvas: "#121214", surface: "#222225", raised: "#2C2C30", text: "#F5F5F7",
      muted: "#B0B0B6", accent: "#7FB2D5", accentText: "#10202B", focus: "#93C6E7",
      line: "#6C6C73", q1: "#D98983", q2: "#7DB9AD", q3: "#CCAE64", q4: "#ADB0BA",
    },
  },
] as const;

export function getDesignDirection(slug: DesignDirectionSlug): DesignDirection {
  const direction = DESIGN_DIRECTIONS.find((candidate) => candidate.slug === slug);
  if (!direction) throw new Error(`Unknown design direction: ${slug}`);
  return direction;
}

export function groupDesignTasks(tasks: readonly DesignTask[]): Record<DesignQuadrantId, DesignTask[]> {
  const grouped: Record<DesignQuadrantId, DesignTask[]> = { q1: [], q2: [], q3: [], q4: [] };
  for (const task of tasks) grouped[task.quadrant].push(task);
  return grouped;
}

export function filterDesignTasks(tasks: readonly DesignTask[], query: string): DesignTask[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [...tasks];
  return tasks.filter((task) => {
    const searchable = [task.title, task.description, task.tags.join(" "), task.dependency ?? ""]
      .join(" ")
      .toLocaleLowerCase();
    return searchable.includes(normalized);
  });
}
