// Reader-facing labels for the web reminder model. Pure functions of their arguments.
export const title = "A task's reminder on the web app, after fix/lost-reminders";

const wants = (v) => !v.sent && v.snooze !== "holding" && (v.dueWin === "open" || v.snooze === "endedOpen");

export const state = (v) => {
  if (v.snooze === "holding") return "Snoozed";
  if (v.dueWin === "open" && !v.seen && v.sent) return "Reminder time came, but it is marked shown";
  if (wants(v)) {
    if (v.dueWin === "before") return "Snooze over before the reminder time";
    return v.seen ? "Reminder due again after a snooze" : "Reminder due";
  }
  if (v.dueWin === "before") return v.sent ? "Waiting, but already marked shown" : "Waiting for the reminder time";
  if (v.seen) return "Reminded";
  return "Reminder hour over, never shown";
};

const GROUP = {
  "Waiting for the reminder time": "Waiting",
  "Snoozed": "Snoozed",
  "Snooze over before the reminder time": "About to remind you",
  "Reminder due": "About to remind you",
  "Reminder due again after a snooze": "About to remind you",
  "Reminded": "Reminded",
  "Waiting, but already marked shown": "No reminder coming",
  "Reminder time came, but it is marked shown": "No reminder coming",
  "Reminder hour over, never shown": "No reminder coming",
};
export const group = (v) => GROUP[state(v)];
export const colors = { Waiting: "tan", Snoozed: "blue", "About to remind you": "yellow", Reminded: "teal", "No reminder coming": "pink" };

// Which arrows the reader needs. Key: "from|action|to" in chart labels.
const KEEP_MOVES = new Set([
  "Reminded|YouMoveDueDate",
  "Reminder hour over, never shown|YouMoveDueDate",
  "Reminder hour over, never shown|OtherDeviceMovesDueDate",
  "Reminded|OtherDeviceMovesDueDate",
  "Waiting for the reminder time|YouSnooze",
  "Reminded|YouSnooze",
]);

export const step = (action, from, to) => {
  const a = state(from);
  const b = state(to);
  switch (action) {
    case "AppShows":
      return from.dueWin === "before" ? "the app shows the reminder early" : "the app shows the reminder";
    case "ReminderTimeComes":
      return "the reminder time comes";
    case "ReminderHourPasses":
      if (a === "Reminder due again after a snooze") return null; // a cleared snooze, then the app stays closed
      return a === "Reminder due" ? "the reminder hour passes with the app closed" : "the reminder hour passes";
    case "SnoozeEnds":
      if (from.dueWin === "before") return "the snooze ends before the reminder time";
      return from.seen ? "the snooze ends after a reminder" : "the snooze ends";
    case "SnoozeHourPasses":
      return a === "Snooze over before the reminder time" ? "an hour passes with the app closed" : null;
    case "YouClearSnooze":
      return b === "Reminder due" ? "you clear the snooze" : null;
    case "YouSnooze":
      return KEEP_MOVES.has(`${a}|${action}`) ? "you snooze" : null;
    case "YouMoveDueDate":
      return KEEP_MOVES.has(`${a}|${action}`) ? "the due date moves later, here or on another device" : null;
    case "OtherDeviceMovesDueDate":
      return KEEP_MOVES.has(`${a}|${action}`) ? "the due date moves later, here or on another device" : null;
    // These change only the stored offset, so they stay inside one label and draw no arrow.
    case "YouSaveTask":
      return "you edit the task";
    case "PushStoresOffset":
      return "sync stores the reminder offset";
    case "OtherDeviceEditsTask":
      return "another device edits the task";
    default:
      return action;
  }
};
