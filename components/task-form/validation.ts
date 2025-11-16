import { taskDraftSchema } from "@/lib/schema";

export { taskDraftSchema };

export interface FormErrors {
  title?: string;
  description?: string;
  dueDate?: string;
  tags?: string;
  subtasks?: string;
}

// Generate time options in 15-minute increments with 12-hour AM/PM format
function generateTimeOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const h24 = hour.toString().padStart(2, '0');
      const m = minute.toString().padStart(2, '0');
      const value = `${h24}:${m}`;

      // Convert to 12-hour format
      const period = hour >= 12 ? 'PM' : 'AM';
      const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const label = `${h12}:${m} ${period}`;

      options.push({ value, label });
    }
  }
  return options;
}

export const TIME_OPTIONS = generateTimeOptions();

export function isoToDateInput(isoValue?: string): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export function isoToTimeInput(isoValue?: string): string {
  if (!isoValue) {
    return "";
  }
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  // Get local time in HH:MM format
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function dateTimeInputToIso(
  dateValue?: string,
  timeValue?: string
): string | undefined {
  if (!dateValue) {
    return undefined;
  }
  // If time is provided, use it; otherwise default to start of day
  const time = timeValue || "00:00";
  const iso = new Date(`${dateValue}T${time}:00`).toISOString();
  return iso;
}
