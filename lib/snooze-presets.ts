import { TIME_UNITS } from "@/lib/constants";

/** The snooze presets, in the same order and spans as iOS and Android (product spec 6.7). */
export const SNOOZE_PRESETS = [
  { label: "15 minutes", minutes: 15 },
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: TIME_UNITS.MINUTES_PER_HOUR },
  { label: "3 hours", minutes: 3 * TIME_UNITS.MINUTES_PER_HOUR },
  { label: "Tomorrow", minutes: TIME_UNITS.MINUTES_PER_DAY },
  { label: "Next week", minutes: 7 * TIME_UNITS.MINUTES_PER_DAY },
] as const;
