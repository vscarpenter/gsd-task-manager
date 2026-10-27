import { stringLimitMessage, type LimitedField } from "@/lib/tasks/crud/validation-error";

/**
 * Says a field's limit once it is reached. maxLength cuts a long paste off
 * without a word, so the same sentence a failed save would show appears here.
 */
export function LengthLimitNote({ field, length, max }: { field: LimitedField; length: number; max: number }) {
  if (length < max) return null;
  return <p className="mt-1 text-caption text-foreground-muted">{stringLimitMessage(field, max)}</p>;
}
