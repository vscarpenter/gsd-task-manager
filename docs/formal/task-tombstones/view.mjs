// Reader-facing labels for the task tombstone model, for /statechart.
// Pure functions of their arguments.
export const title = "Where one task lives: your matrix, Trash, the archive, and the server";

const placesHere = (v) =>
  [v.live.has && "in your matrix", v.trash.has && "in Trash", v.arc.has && "archived"].filter(Boolean);

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

export const state = (v) => {
  const places = placesHere(v);
  if (places.length === 0) return v.srv.has ? "Gone from this device, still on the server" : "Gone everywhere";
  if (places.length > 1) return `${capitalize(places.join(" and "))} at once`;
  return `${capitalize(places[0])}, ${v.srv.has ? "on the server" : "not on the server"}`;
};

export const group = (v) => {
  const places = placesHere(v);
  if (places.length > 1) return "In two places";
  if (places.length === 0) return v.srv.has ? "Only on the server" : "Gone";
  return v.live.has ? "In your matrix" : "In Trash or the archive";
};

export const colors = {
  "In your matrix": "teal",
  "In Trash or the archive": "tan",
  "Only on the server": "yellow",
  "In two places": "pink",
  Gone: "pink",
};

// TLA+ sequences arrive as objects keyed from 1.
const rows = (seq) => Object.values(seq ?? {});
const failedCount = (v) => rows(v.queue).filter((row) => row.failed).length;
const sameRows = (a, b) => state(a) === state(b);

const CLICKS = {
  delete: "Delete",
  undo: "Undo on the delete",
  restoreTrash: "Restore in Trash",
  restoreArchive: "Restore in the archive",
};

export const step = (action, from, to) => {
  switch (action) {
    case "YouStart":
      return `you click ${CLICKS[to.pend.act]} while signed ${from.signedIn ? "in" : "out"}`;
    case "YouDelete":
      return "you delete it";
    case "YouUndo":
      return "the Undo lands";
    case "YouRestoreFromTrash":
      return "you restore it from Trash";
    case "YouRestoreFromArchive":
      return "you restore it from the archive";
    case "YouEdit":
      return "you edit it";
    case "YouArchive":
      return "it's archived";
    case "YouEmptyTrash":
      return "you delete it forever from Trash";
    case "TrashExpires":
      return "30 days pass in Trash";
    case "YouDeleteArchived":
      return "you delete it forever from the archive";
    case "YouUndoDeleteArchived":
      return "you press Undo on that";
    case "YouImport":
      return "you import a backup";
    case "YouSignIn":
      return "you sign in";
    case "YouSignOut":
      return "you sign out";
    case "OtherDeviceEdits":
      return "another device edits it";
    case "OtherDeviceDeletes":
      return "another device deletes it";
    case "RealtimeArrives":
      return from.rt.kind === "delete" ? "that delete arrives live" : "that edit arrives live";
    case "SyncStarts":
      return "a sync starts";
    case "PushSends":
      return from.srv.has && !to.srv.has ? "the sync sends a queued delete" : "the sync sends a queued edit";
    case "PushFails":
      return failedCount(to) > failedCount(from)
        ? "the sync can't send a queued change and gives up on it"
        : "the sync can't send a queued change this time";
    case "PushDone":
      return "the sync's push finishes";
    case "PullFetches":
      return "the sync fetches the server copy";
    case "PullFails":
      return "the sync's pull fails";
    case "PullApplies":
      return "the sync applies the server copy";
    case "ReconcileFetches":
      return "the sync lists the server";
    case "ReconcileSkips":
      return "the sync can't list the server";
    case "ReconcileApplies":
      return sameRows(from, to) ? "the sync finds nothing to remove" : "the sync finds it gone from the server";
    case "ResurrectLists":
      return "the sync checks for deletes made while signed out";
    case "ResurrectSkips":
      return "that check can't list the server";
    case "ResurrectApplies":
      return sameRows(from, to) ? "that check changes nothing" : "the sync brings back a delete made while signed out";
    default:
      return action;
  }
};
