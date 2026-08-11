import { z } from "zod";

export interface JourneyCheck {
  instruction: string;
  schema: z.ZodType;
  predicate: (data: unknown) => boolean;
  expectation: string;
}

export interface Journey {
  name: string;
  path: string;
  seed?: "matrix" | "dashboard";
  urlIncludes?: string;
  steps: string[];
  check: JourneyCheck;
}

const parseWith = <T>(schema: z.ZodType<T>, data: unknown): T | null => {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
};

const aboutSchema = z.object({ isAboutPage: z.boolean() });
const q1Schema = z.object({ q1Titles: z.array(z.string()) });
const activeSchema = z.object({ activeTitles: z.array(z.string()) });
const searchSchema = z.object({ resultTitles: z.array(z.string()) });
const settingsSchema = z.object({ sectionNames: z.array(z.string()) });
const dashboardSchema = z.object({ showsNonZeroAnalytics: z.boolean() });

const MIN_SETTINGS_SECTIONS = 2;

export const journeys: Journey[] = [
  {
    name: "first-visit-redirect",
    path: "/",
    urlIncludes: "/about",
    steps: [],
    check: {
      instruction:
        "Is this an About/landing page introducing the GSD task manager app (rather than the task matrix itself)?",
      schema: aboutSchema,
      predicate: (data) => parseWith(aboutSchema, data)?.isAboutPage === true,
      expectation: "fresh visit to / lands on the about page",
    },
  },
  {
    name: "capture-to-quadrant",
    path: "/",
    steps: [
      'type "Smoke test task !!" into the task capture input at the top of the matrix',
      "press Enter in the task capture input",
    ],
    check: {
      instruction:
        "List the task titles visible in the urgent-and-important quadrant (the one labeled 'Do First').",
      schema: q1Schema,
      predicate: (data) =>
        (parseWith(q1Schema, data)?.q1Titles ?? []).some((title) =>
          title.includes("Smoke test task")
        ),
      expectation: "captured '!!' task lands in Q1 (Do First)",
    },
  },
  {
    name: "complete-task",
    path: "/",
    steps: [
      'type "Complete me smoke !!" into the task capture input',
      "press Enter in the task capture input",
      "click the complete/done control on the task card titled 'Complete me smoke'",
    ],
    check: {
      instruction: "List the titles of active (not completed) task cards visible in the matrix.",
      schema: activeSchema,
      predicate: (data) =>
        !(parseWith(activeSchema, data)?.activeTitles ?? ["Complete me smoke"]).some((title) =>
          title.includes("Complete me smoke")
        ),
      expectation: "completing a task removes it from the active matrix",
    },
  },
  {
    name: "search",
    path: "/",
    steps: [
      'type "Findable smoke task" into the task capture input',
      "press Enter in the task capture input",
      "open the task search",
      'type "Findable" into the search input',
    ],
    check: {
      instruction: "List the task titles shown as search results.",
      schema: searchSchema,
      predicate: (data) =>
        (parseWith(searchSchema, data)?.resultTitles ?? []).some((title) =>
          title.includes("Findable smoke task")
        ),
      expectation: "search finds a just-created task by title",
    },
  },
  {
    name: "settings",
    path: "/settings",
    steps: [],
    check: {
      instruction: "List the settings section or group headings visible on this page.",
      schema: settingsSchema,
      predicate: (data) =>
        (parseWith(settingsSchema, data)?.sectionNames ?? []).length >= MIN_SETTINGS_SECTIONS,
      expectation: "settings page renders its grouped sections",
    },
  },
  {
    name: "dashboard",
    path: "/dashboard",
    seed: "dashboard",
    steps: [],
    check: {
      instruction:
        "Does the dashboard show analytics content with non-zero data (completed counts, charts, or streaks)?",
      schema: dashboardSchema,
      predicate: (data) => parseWith(dashboardSchema, data)?.showsNonZeroAnalytics === true,
      expectation: "seeded history renders non-empty analytics",
    },
  },
];
