// Reader-facing labels for the task lifecycle model. Pure functions of their arguments.
export const title = "One task on the web app, from capture until it's gone";

const PLACE = {
  none: "Not captured yet",
  open: "On your board",
  done: "Done",
  saved: "In Saved",
  archived: "Archived",
  trash: "In Trash",
  gone: "Gone for good",
};

export const state = (v) => {
  let label = PLACE[v.task];
  const openCopies = (v.task === "open" ? 1 : 0) + v.copies;
  if (v.task === "open" && openCopies >= 2) label = "Two open copies on your board";
  else if (v.copies >= 2) label = `${label}, two next copies on your board`;
  else if (v.copies === 1) label = `${label}, next copy on your board`;
  if (v.strays > 0) label += ", plus a copy you never deleted in Trash";
  return label;
};

const GROUP = {
  none: "Not yet",
  open: "On your board",
  done: "Done",
  saved: "Put away",
  archived: "Put away",
  trash: "In Trash",
  gone: "Gone",
};
export const group = (v) => GROUP[v.task];
export const colors = {
  "Not yet": "tan",
  "On your board": "teal",
  Done: "blue",
  "Put away": "purple",
  "In Trash": "yellow",
  Gone: "pink",
};

const STEP = {
  YouCapture: "you capture it",
  YouComplete: "you check it off",
  YouUncheck: "you uncheck it",
  YouUndoComplete: 'you tap Undo [on "Task completed"]',
  YouSaveForLater: "you move it to Saved",
  YouReturnFromSaved: "you put it back on the board",
  YouDelete: "you delete it",
  YouUndoDelete: 'you tap Undo [on "Task deleted"]',
  YouRestoreFromTrash: "you restore it from Trash",
  YouRestoreStray: "you restore the stray copy from Trash",
  TrashEmpties: "Trash empties (by you, or after 30 days)",
  AutoArchive: "auto-archive files it away (days later)",
  YouRestoreFromArchive: "you restore it from the archive",
  YouDeleteFromArchive: "you delete it from the archive",
  YouDeleteCopy: "you delete the next copy",
};

// The delete toast's Undo after you've already moved the task again inside its
// 5 seconds is true but rare, so the chart keeps it only from Trash, plus one
// arrow out of "Gone for good" (Undo still works if Trash empties in that window).
const undoDelete = (from, to) => {
  if (from.task === "trash") return STEP.YouUndoDelete;
  if (from.task === "gone" && to.task === "open") return 'you tap Undo [on "Task deleted", within 5 seconds]';
  return null;
};

export const step = (action, from, to) =>
  action === "YouUndoDelete" ? undoDelete(from, to) : (STEP[action] ?? null);
