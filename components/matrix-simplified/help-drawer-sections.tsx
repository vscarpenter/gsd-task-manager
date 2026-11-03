import { quadrantByRdKey } from "@/lib/quadrants";
import { ROUTES } from "@/lib/routes";
import { HelpLink, Para, QuadrantLine, Section, ShortcutRow, SyntaxRow, bodyStyle, codeStyle } from "./help-drawer-parts";

/**
 * The Field Guide's content, in the order every client's guide shares
 * (GSD Project doc parity/docs-review-2026-11-02.md §3.3). Each claim here is
 * checked against the code it describes; change both together.
 */

type CloseProps = { onClose: () => void };

export function HelpGuideSections({ onClose }: CloseProps) {
  return (
    <>
      <MatrixSection />
      <AddingSection />
      <DueDatesSection />
      <EscalatingSection />
      <WorkingSection />
      <SavedSection onClose={onClose} />
      <TrashSection />
      <FindingSection />
      <ReviewSection onClose={onClose} />
      <ElsewhereSection />
      <SyncSection onClose={onClose} />
      <KeyboardSection />
      <DataSection onClose={onClose} />
      <FeedbackSection onClose={onClose} />
    </>
  );
}

function MatrixSection() {
  return (
    <Section label="The matrix">
      <Para>
        The matrix sorts your tasks into four quadrants by urgency and importance. On a computer they form a
        grid; on a phone the quadrants stack in one column.
      </Para>
      {(["q1", "q2", "q3", "q4"] as const).map((rdKey) => (
        <QuadrantLine key={rdKey} rdKey={rdKey} title={quadrantByRdKey(rdKey).title} hint={quadrantByRdKey(rdKey).rdHint} />
      ))}
    </Section>
  );
}

function AddingSection() {
  return (
    <Section label="Adding a task">
      <Para>
        Every task starts in the Add a task bar. It is at the top on a computer and at the bottom on a phone. Type
        your task and press <kbd>Enter</kbd>. Markers in the text pick the quadrant. To pick it yourself, click or
        tap the quadrant button that appears in the bar as you type. Keyboard tip: press <kbd>Tab</kbd> to reach the
        quadrant button, then press <kbd>Enter</kbd> or <kbd>Space</kbd> to change it.
      </Para>
      <SyntaxRow symbol="!!" meaning="Urgent and important (Do First)" />
      <SyntaxRow symbol="*" meaning="Important (Schedule)" />
      <SyntaxRow symbol="!" meaning="Urgent (Delegate)" />
      <SyntaxRow symbol="none" meaning="No marker: the task goes to Eliminate" />
      <SyntaxRow symbol="#tag" meaning="Adds a tag" />
      <Para muted>
        Example: <code style={codeStyle}>call the bank !! #money #home</code> creates an urgent and important task
        (Do First) tagged <code style={codeStyle}>#money</code> and <code style={codeStyle}>#home</code>.
      </Para>
      <Para>
        A link you type moves into the task&rsquo;s description. Paste several lines to add up to 20 tasks at once,
        one per line. Press <kbd>Shift</kbd> <kbd>N</kbd> for the full New task form.
      </Para>
    </Section>
  );
}

function DueDatesSection() {
  return (
    <Section label="Due dates and reminders">
      <Para>
        In the task form, pick a due date: Today, This week (Friday), Next week (Monday), or a day on the calendar.
        A due date is All day unless you turn All day off and set a time.
      </Para>
      <Para>
        A task with a time reminds you before that time. An all-day task reminds you at 9:00 on its due day. Set the
        default in Settings › Notifications, and turn on Quiet hours there to hold reminders overnight. A reminder
        that lands in quiet hours waits until they end.
      </Para>
      <Para muted>
        Reminders show while GSD is open. Installed as an app in Chrome or Edge, GSD can also check in the
        background.
      </Para>
    </Section>
  );
}

function EscalatingSection() {
  return (
    <Section label="Escalating">
      <Para>
        When a task that isn&rsquo;t marked urgent is due within two days, or is overdue, its card says Escalating.
        Mark urgent, in the task&rsquo;s ⋯ menu, moves it to Do First, or to Delegate if it isn&rsquo;t important.
        Nothing moves on its own. Change the window or turn it off in Settings › Appearance.
      </Para>
    </Section>
  );
}

function WorkingSection() {
  return (
    <Section label="Working with a task">
      <Para lead="Complete">
        tap the circle on a task card. Recurring tasks automatically create the next one.
      </Para>
      <Para lead="Edit">
        hover a task card and click the pencil to open the edit form with that task&rsquo;s details. On a phone the
        pencil is always visible. Save to update, close without saving to cancel.
      </Para>
      <Para lead="More actions">
        the ⋯ button on a task has Move to Saved, Move to (pick a quadrant), Share, Duplicate, Snooze, and Delete.
        Snooze offers 15 minutes, 30 minutes, 1 hour, 3 hours, Tomorrow (a day from now), Next week (a week from
        now), and Clear snooze. On a computer, hover a task to see the main actions as icons.
      </Para>
      <Para lead="Swipe on a touch screen">
        swipe a task right to complete it. Swipe left to snooze it for 1 hour or delete it.
      </Para>
      <Para lead="Move">
        drag a task onto any other quadrant; the quadrant under it lights up. Or choose Move to from the ⋯ menu. A
        plain click never starts a drag.
      </Para>
      <Para lead="Track time">
        give a task an Estimate in the form and a timer appears on its card. Start it to track time against the
        estimate.
      </Para>
    </Section>
  );
}

function SavedSection({ onClose }: CloseProps) {
  return (
    <Section label="Saved">
      <Para>
        Saved keeps a task out of the matrix until you&rsquo;re ready for it, like an article to read or an idea.
        Choose Move to Saved from a task&rsquo;s ⋯ menu. In{" "}
        <HelpLink href={ROUTES.SAVED} onClose={onClose}>Saved</HelpLink>, edit its notes and links, then choose
        Return to matrix to make it an active task again.
      </Para>
      <Para muted>
        Saved items don&rsquo;t show in the matrix, smart views, or Review, and they don&rsquo;t send reminders.
      </Para>
    </Section>
  );
}

function TrashSection() {
  return (
    <Section label="Undo, Trash, and Archive">
      <Para>
        Undo appears right after you delete, complete, or move a task. A deleted task stays in Trash for 30 days;
        restore it from Settings › Trash.
      </Para>
      <Para>
        Completed tasks can move to the archive on their own after 30, 60, or 90 days. Turn that on, or archive
        now, in Settings › Archive.
      </Para>
    </Section>
  );
}

function FindingSection() {
  return (
    <Section label="Finding things">
      <Para>
        Press <kbd>/</kbd> to search your tasks. Press <kbd>⌘</kbd> <kbd>K</kbd> for the command palette, which
        searches tasks, views, and actions.
      </Para>
      <Para>
        Turn on smart views in Settings › Features for nine ready-made filters, like Today&rsquo;s Focus and Overdue
        Backlog, in the matrix and the palette.
      </Para>
    </Section>
  );
}

function ReviewSection({ onClose }: CloseProps) {
  return (
    <Section label="Review">
      <Para>
        <HelpLink href={ROUTES.DASHBOARD} onClose={onClose}>Review</HelpLink> shows what you finished, your streak,
        where your tasks sit, what&rsquo;s due soon, your tags, and where your time went.
      </Para>
    </Section>
  );
}

function ElsewhereSection() {
  return (
    <Section label="Getting tasks in from elsewhere">
      <Para>
        On Android, install GSD from Chrome, then share a page to GSD from any app. On a computer, add the
        bookmarklet from Settings › Bookmarklet, then click it on any page.
      </Para>
      <Para muted>
        Either way, GSD opens the New task form with the page filled in. Nothing is saved until you choose Create
        task.
      </Para>
    </Section>
  );
}

function SyncSection({ onClose }: CloseProps) {
  return (
    <Section label="Cloud sync (optional)">
      <Para>
        The cloud icon at the top is your sync control. Click it to sign in with Google, Apple, or GitHub. Signing
        in creates a sync account and uploads the tasks already in this browser to a server run by GSD&rsquo;s
        developer. After that, your devices show the same tasks.
      </Para>
      <Para muted>
        A number on the icon counts changes waiting to sync. An exclamation mark means your session expired. Click
        the icon to sign in again. Visit{" "}
        <HelpLink href="/sync-history" onClose={onClose}>Sync history</HelpLink> for a recent log, or{" "}
        <HelpLink href={ROUTES.SETTINGS} onClose={onClose}>Settings</HelpLink> to change how often it syncs, sign
        out, or delete the account.
      </Para>
      <Para muted>
        You stay signed in as long as you open GSD at least once every 30 days. Signing out keeps the tasks in this
        browser.
      </Para>
    </Section>
  );
}

function KeyboardSection() {
  return (
    <Section label="Keyboard tips">
      <ShortcutRow keys={["n"]} action="Jump to the Add a task bar" />
      <ShortcutRow keys={["⌘", "K"]} action="Open the command palette" />
      <ShortcutRow keys={["Shift", "N"]} action="Open the full New task form" />
      <ShortcutRow keys={["/"]} action="Go to the search field" />
      <ShortcutRow keys={["⌥", "/"]} action="Search tasks from any page" />
      <ShortcutRow keys={["⌥", "N"]} action="Jump to the Add a task bar from any page" />
      <ShortcutRow keys={["⌥", "R"]} action="Open Review" />
      <ShortcutRow keys={["⌥", "1–4"]} action="Go to a quadrant" />
      <ShortcutRow keys={["Enter"]} action="Add the task (in the Add a task bar)" />
      <ShortcutRow keys={["?"]} action="Open this guide" />
      <ShortcutRow keys={["Esc"]} action="Close any open panel" />
      <p style={{ ...bodyStyle, color: "var(--gray-500)", fontSize: "var(--t-caption)" }}>
        On Windows and Linux, use Ctrl instead of ⌘ and Alt instead of ⌥. Option shortcuts use the key&rsquo;s
        position on the keyboard. They are off while you type in a text field or have a dialog open.
      </p>
    </Section>
  );
}

function DataSection({ onClose }: CloseProps) {
  return (
    <Section label="Your data">
      <Para>
        Your tasks are stored in this browser and work offline. They are never sent to a server unless you turn on
        sync with the cloud icon at the top. Feedback you choose to send goes to GSD&rsquo;s server and contains none
        of your tasks. Sync settings are in{" "}
        <HelpLink href={ROUTES.SETTINGS} onClose={onClose}>Settings</HelpLink> once you are signed in.
      </Para>
      <Para>
        Export a backup from Settings › Data &amp; Storage. When you import one, Merge Tasks adds its tasks to yours
        and Replace Everything restores it over the tasks in this browser.
      </Para>
      <Para muted>
        Reset everything deletes everything in this browser and signs you out. If you use sync, your synced copy
        stays on the server until you delete the account.
      </Para>
    </Section>
  );
}

function FeedbackSection({ onClose }: CloseProps) {
  return (
    <Section label="Feedback">
      <Para>
        Found a problem, or want something added?{" "}
        <HelpLink href="/settings#feedback" onClose={onClose}>Send feedback</HelpLink>
        . It has no account or device identifier, and you can read exactly what is sent before it goes.
      </Para>
      <Para>
        More about GSD:{" "}
        <HelpLink href={ROUTES.ABOUT} onClose={onClose}>read the About page →</HelpLink>
      </Para>
    </Section>
  );
}
