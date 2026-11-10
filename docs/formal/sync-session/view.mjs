// Reader-facing labels for the sync-session model, for /statechart.
// Pure functions of their arguments. A and B are two accounts; "A's task" is a
// task that came from account A, or a queued edit of one.
export const title = "Sign in and sync on the web app, as the code is today";

const NONE = "none";
const owners = (xs) => [...new Set(xs)].sort();
const possessive = (xs) => owners(xs).map((x) => `${x}'s`).join(" and ");

function onDevice(v) {
  const rows = owners(v.rows);
  const queued = owners(v.queue);
  if (rows.length === 0 && queued.length === 0) return null;
  if (queued.length === 0) return `${possessive(rows)} task on this device`;
  if (rows.length === 0) return `${possessive(queued)} task queued, none on this device`;
  return `${possessive(rows)} task on this device, ${possessive(queued)} queued`;
}

function onServer(v) {
  const misplaced = Object.entries(v.srv).flatMap(([account, records]) =>
    records.filter((r) => r !== account).map((r) => `${r}'s task in ${account}'s account`));
  return misplaced.length ? misplaced.join(", ") : null;
}

function inFlight(v) {
  const work = [];
  if (["auth", "refreshing", "push"].includes(v.sp)) work.push(`a sync for ${v.owner} starting`);
  if (v.sp === "pull" && v.owner !== NONE) work.push(`a sync for ${v.owner} starting`);
  if (v.sp === "pushing") work.push(`a sync sending as ${v.pushOwner}`);
  if (v.sp === "checking") work.push(`a sync for ${v.pushOwner} checking its session`);
  if (v.sp === "applying") work.push(`a sync saving ${v.pullOwner}'s tasks`);
  if (v.si === "persist") work.push(`${v.siWho}'s sign-in saving`);
  if (v.si === "popread" || v.si === "popwrite") work.push("sign-in queuing local tasks");
  if (v.so === "commit") work.push(v.soReset ? "a reset in progress" : "a sign-out in progress");
  if (v.so === "clear") work.push("a sign-out clearing the token");
  if (v.so === "wipe" || v.so === "storage") work.push("a reset erasing data");
  if (v.st.length) work.push("a Settings change saving");
  if (v.ed) work.push("a task edit saving");
  if (v.ev.length) work.push(`a realtime change for ${v.ev[0].o} arriving`);
  return work;
}

export const state = (v) => {
  const session = v.cfg.on ? `Signed in as ${v.cfg.user}` : "Signed out";
  const detail = [onServer(v), onDevice(v), ...inFlight(v)].filter(Boolean);
  return [session, detail.length ? detail.join(", ") : "Nothing on this device"];
};

export const group = (v) => (v.cfg.on ? "Signed in" : "Signed out");
export const colors = { "Signed out": "tan", "Signed in": "teal" };

export const step = (action, from, to) => {
  switch (action) {
    case "SyncStarts":
      return `a sync for ${to.owner} starts`;
    case "TokenFresh":
      return to.sp === "idle" ? "the sync stops: no token, so it asks you to sign in" : "the sync checks the token";
    case "RefreshSent":
      return "the sync refreshes the token";
    case "RefreshLands":
      if (to.sp === "idle") {
        return to.tok !== from.tok ? "the server refuses the token, so the sync forgets it and asks you to sign in" : "the token refresh fails and the sync asks you to sign in";
      }
      return to.tok !== from.tok ? `the token refresh lands and saves ${to.tok}'s token` : "the token refresh lands";
    case "PushChecks":
      return "the push checks its session before trusting a lookup that found nothing";
    case "CheckLands":
      if (to.sp === "pushing") return "the session check lets the push go on";
      return to.tok !== from.tok ? "the server refuses the token, so the push forgets it and asks you to sign in" : "the session check stops the push";
    case "PushStarts":
      if (to.sp === "pushing") return `the push reads the queue as ${to.pushOwner}`;
      return to.sp === "idle" ? "the push stops: no session" : "the push finds no token";
    case "PushSends": {
      const sent = from.pending.filter((r) => !to.pending.includes(r));
      const landed = to.srv[from.pushOwner].length > from.srv[from.pushOwner].length;
      return landed ? `the push sends ${sent[0]}'s task to ${from.pushOwner}'s account` : "the server refuses the push";
    }
    case "PushEnds":
      return "the push finishes";
    case "PullFetches":
      return to.sp === "applying" ? `the pull fetches ${to.pullOwner}'s tasks` : "the pull finds no token";
    case "PullApplies":
      return to.rows.length > from.rows.length ? "the pull saves them" : "the pull's session check drops them";
    case "EventArrives":
      return `a realtime change for ${to.ev[0].o} arrives`;
    case "EventApplies":
      return to.rows.length > from.rows.length ? "the realtime change saves" : "the session check drops the realtime change";
    case "YouSignIn":
      return `you sign in as ${to.siWho}`;
    case "SignInSaves":
      return to.cfg.on && to.cfg.user === from.siWho ? `${from.siWho}'s sign-in saves` : "sign-in refuses: tasks belong to another account";
    case "PopulateReads":
      return "sign-in reads the local tasks";
    case "PopulateWrites":
      return "sign-in queues them";
    case "YouSignOut":
      return to.soReset ? "you choose Reset Everything" : "you sign out";
    case "SignOutSaves":
      return "the sign-out saves the row it read";
    case "SignOutClearsToken":
      return "the sign-out clears the token";
    case "ResetWipes":
      return "the reset erases local data";
    case "ResetReloads":
      return "the reset reloads the tab";
    case "YouChangeAutoSync":
      return "you change auto-sync in Settings";
    case "AutoSyncSaves":
      return "Settings saves the row it read";
    case "YouEditTask":
      return "you edit a task";
    case "EditSaves":
      return to.queue.length > from.queue.length ? "the edit queues the task" : "the edit saves";
    default:
      return action;
  }
};
