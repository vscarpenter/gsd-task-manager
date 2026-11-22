const READS = new Set(["get", "toArray", "bulkGet", "first", "primaryKeys", "sortBy"]);
const WRITES = new Set(["put", "add", "update", "delete", "clear", "bulkPut", "bulkAdd", "bulkDelete", "bulkUpdate", "modify"]);
const SETTINGS_TABLES = new Set(["notificationSettings", "appPreferences", "archiveSettings"]);
const SESSION_READERS = new Set(["getSyncConfig", "getSyncContext"]);
const FUNCTIONS = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"]);

const calleeName = (call) => call.callee.property?.name ?? call.callee.name;
const isDbObject = (node) =>
  (node?.type === "Identifier" && (node.name === "db" || node.name === "database")) ||
  (node?.type === "CallExpression" && node.callee.name === "getDb");
const opensTransaction = (call) =>
  calleeName(call) === "runTaskSyncTransaction" || (calleeName(call) === "transaction" && call.arguments.length > 1);

function findVariable(sourceCode, node) {
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
    const variable = scope.set.get(node.name);
    if (variable) return variable;
  }
  return undefined;
}

/** `db.x`, `getDb().x`, a query chained on either, or a const that holds one. */
function tableName(sourceCode, expression) {
  let node = expression;
  const seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    if (node.type === "CallExpression") node = node.callee.object;
    else if (node.type === "MemberExpression") {
      if (isDbObject(node.object)) return node.property.name;
      node = node.object;
    } else if (node.type === "Identifier") {
      node = findVariable(sourceCode, node)?.defs[0]?.node.init;
    } else return undefined;
  }
  return undefined;
}

function functionName(fn) {
  if (fn.id) return fn.id;
  if (fn.parent.type === "VariableDeclarator" || fn.parent.type === "MethodDefinition") return fn.parent.id ?? fn.parent.key;
  return undefined;
}

/** The function a reader would name: callbacks count as part of it. */
function owningFunction(node) {
  let outer;
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!FUNCTIONS.has(parent.type)) continue;
    if (functionName(parent)) return parent;
    outer = parent;
  }
  return outer;
}

/**
 * Inside a transaction callback, in a *InTransaction helper, or in a helper
 * this file calls only from inside one.
 */
function runsInTransaction(sourceCode, node, seen = new Set()) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (!FUNCTIONS.has(parent.type)) continue;
    if (parent.parent.type === "CallExpression" && parent.parent.arguments.includes(parent) && opensTransaction(parent.parent)) return true;
    const name = functionName(parent);
    if (!name) continue;
    if (name.name?.endsWith("InTransaction")) return true;
    if (seen.has(parent) || /^Export/.test(parent.parent.type)) return false;
    seen.add(parent);
    const declaration = parent.id ? parent : parent.parent;
    const [variable] = sourceCode.getDeclaredVariables(declaration);
    const uses = variable?.references.filter((ref) => ref.isRead()) ?? [];
    return uses.length > 0 && uses.every((ref) => runsInTransaction(sourceCode, ref.identifier, seen));
  }
  return false;
}

const atomicWrites = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      readThenWrite:
        "Another writer can land between this read of {{table}} and the write, and this write erases it. Use modifyRow(table, key, change) from lib/db-row.ts, or move both into one db.transaction.",
      settingsPut:
        "A whole-row put to {{table}} erases a setting saved since it was read. Use modifyRow(table, key, change) from lib/db-row.ts.",
      asyncScope:
        "Dexie drops the transaction at a native await unless its scope is an async function. Write the scope as `async () => { ... }`.",
      staleSession:
        "A sign-in or sign-out can land between this read and the transaction. Move the sync_config read inside it, with db.syncMetadata in its tables.",
    },
  },
  create(context) {
    const { sourceCode } = context;
    const ops = [];
    const calls = [];
    const sessionChecks = [];
    return {
      CallExpression(node) {
        const name = calleeName(node);
        if (opensTransaction(node)) {
          ops.push({ kind: "transaction", node });
          const scope = node.arguments.at(-1);
          if (name === "transaction" && FUNCTIONS.has(scope?.type) && !scope.async) context.report({ node: scope, messageId: "asyncScope" });
        }
        const table = node.callee.type === "MemberExpression" ? tableName(sourceCode, node.callee.object) : undefined;
        const readsSession = SESSION_READERS.has(name) ||
          (table === "syncMetadata" && name === "get" && node.arguments[0]?.value === "sync_config");
        if (readsSession) ops.push({ kind: "session", node }, { kind: "read", node, table: "syncMetadata" });
        if (node.callee.type === "Identifier") calls.push(node);
        if (name === "assertSyncSessionCurrent") sessionChecks.push(node);
        if (table && READS.has(name)) ops.push({ kind: "read", node, table });
        if (table && WRITES.has(name)) ops.push({ kind: "write", node, table, name });
      },
      "Program:exit"() {
        const outside = ops
          .filter((op) => !runsInTransaction(sourceCode, op.node))
          .map((op) => ({ ...op, owner: owningFunction(op.node) }));
        // A transaction that rechecks the session may act on an owner read earlier.
        const rechecks = ({ node }) =>
          sessionChecks.some((check) => node.range[0] < check.range[0] && check.range[1] < node.range[1]);
        const direct = outside.filter((op) => op.kind !== "transaction" || !rechecks(op));
        // One level of helper: a call counts as the session read or transaction its body holds.
        for (const call of calls) {
          const def = findVariable(sourceCode, call.callee)?.defs[0]?.node;
          const helper = def?.init ?? def;
          if (!helper || !FUNCTIONS.has(helper.type) || runsInTransaction(sourceCode, call)) continue;
          for (const kind of ["session", "transaction"]) {
            if (direct.some((op) => op.kind === kind && op.owner === helper)) {
              outside.push({ kind, node: call, owner: owningFunction(call) });
            }
          }
        }
        const reported = new Set();
        for (const op of outside) {
          const before = (kind) => outside.find(
            (other) => other.kind === kind && other.owner === op.owner && other.node.range[0] < op.node.range[0] &&
              (kind !== "read" || other.table === op.table),
          );
          if (op.kind === "write") {
            if (SETTINGS_TABLES.has(op.table) && op.name === "put") {
              context.report({ node: op.node, messageId: "settingsPut", data: { table: op.table } });
            } else if (before("read")) {
              context.report({ node: op.node, messageId: "readThenWrite", data: { table: op.table } });
            }
          } else if (op.kind === "transaction" && !rechecks(op)) {
            const stale = before("session");
            if (stale && !reported.has(stale.node)) context.report({ node: stale.node, messageId: "staleSession" });
            if (stale) reported.add(stale.node);
          }
        }
      },
    };
  },
};

const plugin = { rules: { "atomic-writes": atomicWrites } };

export default plugin;
