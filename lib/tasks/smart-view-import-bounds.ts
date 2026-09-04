import { SCHEMA_LIMITS } from "@/lib/constants/schema";

interface StructureNode {
  value: unknown;
  depth: number;
}

interface StructureState {
  stack: StructureNode[];
  seen: WeakSet<object>;
  inputNodes: number;
  stringBytes: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function addBoundedString(value: string, state: StructureState): void {
  if (value.length > SCHEMA_LIMITS.SMART_VIEW_MAX_STRING_BYTES) {
    throw new Error("Smart-view string data exceeds the supported maximum.");
  }
  state.stringBytes += new TextEncoder().encode(value).byteLength;
  if (state.stringBytes > SCHEMA_LIMITS.SMART_VIEW_MAX_STRING_BYTES) {
    throw new Error("Smart-view string data exceeds the supported maximum.");
  }
}

function getChildren(value: object): unknown[] {
  if (Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  return Object.keys(record).map((key) => record[key]);
}

function addBoundedChildren(
  node: StructureNode,
  children: unknown[],
  state: StructureState,
): void {
  state.inputNodes += children.length;
  if (state.inputNodes > SCHEMA_LIMITS.SMART_VIEW_MAX_INPUT_NODES) {
    throw new Error("Smart-view structure exceeds the supported complexity.");
  }
  for (const child of children) {
    state.stack.push({ value: child, depth: node.depth + 1 });
  }
}

function visitStructureNode(node: StructureNode, state: StructureState): void {
  if (typeof node.value === "string") {
    addBoundedString(node.value, state);
    return;
  }
  if (!node.value || typeof node.value !== "object") return;
  if (node.depth > SCHEMA_LIMITS.SMART_VIEW_MAX_DEPTH) {
    throw new Error("Smart-view structure exceeds the supported nesting depth.");
  }
  if (state.seen.has(node.value)) return;
  state.seen.add(node.value);
  addBoundedChildren(node, getChildren(node.value), state);
}

function assertAggregateStructureBounds(roots: unknown[]): void {
  const state: StructureState = {
    stack: roots.map((value) => ({ value, depth: 0 })),
    seen: new WeakSet<object>(),
    inputNodes: 0,
    stringBytes: 0,
  };
  while (state.stack.length > 0) {
    visitStructureNode(state.stack.pop()!, state);
  }
}

/**
 * Fail closed on the resource cost of raw, untrusted smart-view input: nesting
 * depth, aggregate node count, aggregate UTF-8 bytes.
 *
 * Only memory bounds live here. Shape and count bounds — field lengths, the
 * per-collection cap, criteria array caps — belong to the import path, which
 * skips the offending row and counts it. A single unrepresentable view must
 * never abort a payload carrying the user's tasks, archive, trash and settings.
 */
export function assertRawSmartViewBounds(payload: unknown): void {
  const record = asRecord(payload);
  if (!record) return;
  const roots = [record.smartViews, record.appPreferences].filter(
    (value) => value !== undefined,
  );
  assertAggregateStructureBounds(roots);
}
