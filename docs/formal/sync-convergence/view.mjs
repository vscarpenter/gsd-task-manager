// Reader-facing labels for the sync convergence model. Pure functions of their arguments.
export const title = "One task on two devices: does everyone end up with the newest edit?";

const DEVICES = ["A", "B"];
// A TLA+ sequence arrives as an object keyed from 1, or empty.
const rows = (seq) => Object.values(seq ?? {});
// Device edits are named by their tick (at most 4); the fast clock's copy is named past the 10-tick ceiling.
const isFast = (copy) => copy.v > 10;
const pending = (v, d) => rows(v.queue[d]).some((r) => r.st === "pending");
const gaveUp = (v, d) => rows(v.queue[d]).some((r) => r.st === "failed");
const other = (d) => (d === "A" ? "B" : "A");

const quiet = (v) =>
  DEVICES.every((d) => !pending(v, d) && v.phase[d] === "idle" && rows(v.events[d]).length === 0 && v.pulled[d]);

function device(v, d) {
  let label;
  if (pending(v, d)) label = "has an unsent edit";
  else if (v.local[d].v === v.server.v) label = "shows the server's copy";
  else if (isFast(v.local[d])) label = "shows the fast clock's copy";
  else if (v.server.at < v.cursor[d]) label = "is behind, and its pulls skip the server's copy";
  else if (v.local[d].v > v.server.v && !isFast(v.server)) label = "holds an edit the server lacks";
  else label = "is behind the server";
  if (gaveUp(v, d)) label += ", and gave up sending an edit";
  const passed = rows(v.queue[other(d)]).some((r) => r.st === "pending" && r.at < v.cursor[d]);
  if (passed) label += `, and its pulls now start after ${other(d)}'s unsent edit`;
  return `${d} ${label}`;
}

function server(v) {
  if (isFast(v.server)) return "the server has the fast clock's copy";
  return v.server.v === v.newest ? "the server has the newest edit" : "the server has an older edit than the newest";
}

export const state = (v) => `${quiet(v) ? "Quiet" : "Syncing"}: ${device(v, "A")}; ${device(v, "B")}; ${server(v)}`;

export const group = (v) => (quiet(v) ? "Quiet" : "Syncing");
export const colors = { Quiet: "teal", Syncing: "tan" };

// The device whose value of `key` the step changed.
function mover(from, to, keys) {
  for (const key of keys) {
    for (const d of DEVICES) {
      if (JSON.stringify(from[key][d]) !== JSON.stringify(to[key][d])) return d;
    }
  }
  return "a device";
}

export const step = (action, from, to) => {
  switch (action) {
    case "YouEdit":
      return `you edit on ${mover(from, to, ["queue"])}`;
    case "PushSends":
    case "PushWrites": {
      const d = mover(from, to, ["queue", "reading"]);
      return JSON.stringify(from.server) === JSON.stringify(to.server)
        ? `${d} drops its edit as older than the server's`
        : `${d} sends its edit`;
    }
    case "PushReads":
      return `${mover(from, to, ["reading"])} reads the server's copy before sending`;
    case "PushFails": {
      const d = mover(from, to, ["queue"]);
      return gaveUp(to, d) && !gaveUp(from, d) ? `${d} gives up sending its edit` : `${d}'s send fails`;
    }
    case "Pulls": {
      const d = mover(from, to, ["phase"]);
      if (JSON.stringify(from.local[d]) !== JSON.stringify(to.local[d])) return `${d} pulls the server's copy`;
      if (from.cursor[d] !== to.cursor[d]) return `${d} pulls another task's newer record`;
      return `${d} pulls and gets nothing new`;
    }
    case "SyncFails":
      return `${mover(from, to, ["phase"])}'s sync fails`;
    case "EventArrives": {
      const d = mover(from, to, ["events"]);
      return JSON.stringify(from.local[d]) !== JSON.stringify(to.local[d])
        ? `${d} takes a realtime event`
        : `${d} ignores a realtime event`;
    }
    case "EventLost":
      return `${mover(from, to, ["events"])} misses a realtime event`;
    case "FastClockSaves":
      return "a device with a fast clock saves the task";
    case "SyncStarts":
      return `${mover(from, to, ["phase"])} starts a sync`;
    case "PushDone":
      return `${mover(from, to, ["phase"])} finishes sending`;
    case "TimePasses":
      return "time passes";
    default:
      return action;
  }
};
