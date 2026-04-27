export type DuePreset = "none" | "today" | "this-week" | "next-week";

export const DUE_PRESETS: { value: DuePreset; label: string }[] = [
  { value: "none", label: "None" },
  { value: "today", label: "Today" },
  { value: "this-week", label: "This week" },
  { value: "next-week", label: "Next week" },
];

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function resolveDuePreset(
  preset: DuePreset,
  now: Date = new Date(),
): string | undefined {
  if (preset === "none") return undefined;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") return toIsoDate(today);

  if (preset === "this-week") {
    const dow = today.getDay(); // 0=Sun, 5=Fri, 6=Sat
    let daysToFri = (5 - dow + 7) % 7;
    if (dow === 6) daysToFri = 6; // Saturday → next Friday (6 days)
    const fri = new Date(today);
    fri.setDate(today.getDate() + daysToFri);
    return toIsoDate(fri);
  }

  // next-week → next Monday strictly after today
  const dow = today.getDay();
  const daysToMon = ((1 - dow + 7) % 7) || 7;
  const mon = new Date(today);
  mon.setDate(today.getDate() + daysToMon);
  return toIsoDate(mon);
}
