const READS = new Set(["getList", "getFullList", "getFirstListItem", "getOne", "subscribe", "unsubscribe"]);
const GUARDED_ROUTE = /\/api\/gsd\/tasks\b/;

function isReadMember(node) {
  return node.parent?.type === "MemberExpression" && READS.has(node.parent.property.name);
}

/** A collection kept in a variable counts as a read only if every use of it is one. */
function isReadOnly(node, sourceCode) {
  if (isReadMember(node)) return true;
  if (node.parent?.type !== "VariableDeclarator") return false;
  const [variable] = sourceCode.getDeclaredVariables(node.parent);
  if (!variable) return false;
  const uses = variable.references.filter((ref) => ref.isRead());
  return uses.length > 0 && uses.every((ref) => isReadMember(ref.identifier));
}

const claimedTaskWrites = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      unclaimed:
        "An unclaimed write can delete a task the user restored. Get a claim with claimQueuedWrite(kind, queueId, ownerId) and pass it to sendTaskUpdate, sendTaskCreate, or sendTaskDelete from lib/sync/queued-write.ts.",
    },
  },
  create(context) {
    const report = (node) => context.report({ node, messageId: "unclaimed" });
    return {
      Literal(node) {
        if (typeof node.value === "string" && GUARDED_ROUTE.test(node.value)) report(node);
      },
      TemplateElement(node) {
        if (GUARDED_ROUTE.test(node.value.raw)) report(node);
      },
      'CallExpression[callee.property.name="collection"][arguments.0.value="tasks"]'(node) {
        if (!isReadOnly(node, context.sourceCode)) report(node);
      },
    };
  },
};

const plugin = { rules: { "claimed-task-writes": claimedTaskWrites } };

export default plugin;
