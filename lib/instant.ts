/**
 * Orders stored instants by time. They may carry an offset, so their text order
 * isn't their time order. A missing or unreadable one counts as the oldest.
 */
export function compareInstants(a: string | undefined, b: string | undefined): number {
  const left = timeOf(a);
  const right = timeOf(b);
  return left < right ? -1 : left > right ? 1 : 0;
}

function timeOf(instant: string | undefined): number {
  const ms = Date.parse(instant ?? "");
  return Number.isNaN(ms) ? -Infinity : ms;
}
