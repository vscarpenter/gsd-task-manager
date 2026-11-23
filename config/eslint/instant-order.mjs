/**
 * Stored instants may carry an offset (`z.iso.datetime({ offset: true })`), so
 * their text order isn't their time order. This rule rejects ordering them as text.
 */
export const INSTANT_FIELDS = new Set([
  "archivedAt", "completedAt", "createdAt", "deletedAt", "dueDate", "endedAt", "exportedAt",
  "lastNotificationAt", "savedAt", "snoozedUntil", "startedAt", "updatedAt",
  "clientUpdatedAt", "lastClientUpdatedAt", "lastSuccessfulSyncAt", "lastSyncAt",
  "client_created_at", "client_updated_at", "completed_at", "due_date",
  "last_notification_at", "saved_at", "snoozed_until",
]);

const ORDERING = new Set(["<", "<=", ">", ">="]);
const TEXT_CUTS = new Set(["slice", "substring", "substr"]);
const TEXT_COMPARES = new Set(["compareText", "compareStrings"]);

function findVariable(sourceCode, node) {
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(node.name);
    if (variable) return variable;
  }
  return undefined;
}

/** A local takes its meaning from what it was set to. A parameter takes it from its name. */
function identifierIsInstant(sourceCode, node, seen) {
  if (/(?:Iso|ISO)$/.test(node.name)) return true;
  const def = findVariable(sourceCode, node)?.defs[0];
  if (def?.type === "Variable" && def.node.id.type === "Identifier" && def.node.init) {
    return isInstantText(sourceCode, def.node.init, seen);
  }
  return INSTANT_FIELDS.has(node.name);
}

function isInstantText(sourceCode, node, seen = new Set()) {
  if (!node || seen.has(node)) return false;
  seen.add(node);
  switch (node.type) {
    case "ChainExpression":
    case "TSNonNullExpression":
    case "TSAsExpression":
      return isInstantText(sourceCode, node.expression, seen);
    case "LogicalExpression":
      return (node.operator === "??" || node.operator === "||") && isInstantText(sourceCode, node.left, seen);
    case "MemberExpression":
      return INSTANT_FIELDS.has(node.computed ? node.property.value : node.property.name);
    case "Identifier":
      return identifierIsInstant(sourceCode, node, seen);
    case "CallExpression": {
      const method = node.callee.property?.name;
      return method === "toISOString" || (TEXT_CUTS.has(method) && isInstantText(sourceCode, node.callee.object, seen));
    }
    default:
      return false;
  }
}

const rule = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      textOrder:
        "An instant can carry an offset, so its text order isn't its time order. Sort with compareInstants(a, b) from @/lib/instant. For a cutoff, use Date.parse(value) < cutoffMs, which is false for a bad value.",
    },
  },
  create(context) {
    const { sourceCode } = context;
    const check = (node, operands) => {
      if (operands.some((operand) => isInstantText(sourceCode, operand))) {
        context.report({ node, messageId: "textOrder" });
      }
    };
    return {
      BinaryExpression(node) {
        if (ORDERING.has(node.operator)) check(node, [node.left, node.right]);
      },
      CallExpression(node) {
        if (node.callee.property?.name === "localeCompare") check(node, [node.callee.object, ...node.arguments]);
        else if (TEXT_COMPARES.has(node.callee.name)) check(node, node.arguments);
      },
    };
  },
};

const plugin = { rules: { "instant-order": rule } };

export default plugin;
