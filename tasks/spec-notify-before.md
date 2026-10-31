# Contract note: `notify_before` is always a number

**Status:** decided, 2026-10-31. Sprint 2 builds it. Not implemented on any client.
**Decision:** D-10, option 1 (`sprint/OWNER-DECISIONS.md` items 9 and 17). Evidence: `sprint/findings/D-10.md`.
**No new field, no pull contract bump, no backup envelope change, no server change, no corpus.** The rule is one fallback expression, so each client's tests pin it (section 7).
**Evidence:** code paths come from reading web, iOS, and Android `main` on 2026-10-31. The server behavior is S-AND's finding, run on PocketBase 0.40.4. Nothing here has run on a client.

## 1. The problem

PocketBase never stores a null number, and `0` already means "at the due time". So a null offset means different things on different devices today. The device that wrote it fires its own default, and every other device pulls `0` and fires at the due time. Clearing an offset also splits: web's null stores `0`, and iOS and Android omit the key, so the server keeps the old value.

## 2. The rule

1. **A new or edited task stores a number.** Create, editor save, duplicate, and import resolve `notifyBefore ?? this device's default reminder` before the row is written. The value is then the same on every device.
2. **The wire always carries a number.** The push mapper can't send null and can't omit the key. It takes `payload ?? current row ?? this device's default`. Web's mapper stops writing null, and iOS's and Android's stop omitting.
3. **`0` means "at the due time"**, as it does today. It never means unset or off.
4. **Off is `notification_enabled: false`, and the number stays.** Turning a reminder off no longer clears the offset, so turning it back on restores it. `notify_before` plays no part in whether a reminder fires.
5. **A later change to the default doesn't move existing tasks.** Vinny accepted this. Settings says so (section 6).

## 3. Rows already stored

Nothing migrates at upgrade. A migration would write every row, and to reach other devices it would have to bump every stamp and push. Each row settles the next time it's written.

| Stored | Who | What happens |
|---|---|---|
| Server `0` | Any device | Stays `0`, "at the due time". A real choice and an old null look the same, so it can't be repaired. Those other devices already behave this way, so nothing changes for them |
| Local null, server `0` | The device that wrote it | Keeps firing its default through the read fallback, as it does today. The next write of that row resolves it and pushes, and other devices move from `0` to that number |
| Local null, server holds an old value | iOS or Android, after clearing an offset | Same. The next write replaces the old value |
| A queued payload with null, from before the upgrade | Any client | Rule 2 at drain. If the row was null too, store the number on the row with no stamp bump and nothing queued, so this device and the server agree |
| A backup with no offset | Import | Rule 1 applies. `notifyBefore` stays optional in the import schemas, so old backups still import |

Reads keep `notifyBefore ?? default` for good: local null rows can outlive any one release. It's a data persistence exception, so the fallback isn't a shim to remove later. Pull is unchanged, and a pulled number replaces a local null only by the ordinary strictly-newer rule.

**Accepted edge:** a device with a cleared cursor re-queues rows, on iOS through its seed. If such a row is null, its push writes this device's default over the server's value at an equal stamp, and other devices treat an equal stamp as a no-op until the next edit. This divergence exists today in a different form, and it clears on the next edit.

**During rollout:** an older build keeps sending null or omitting the key until it updates, so an older web build can still turn a number into `0` on its own edit. Nothing can prevent that from here.

## 4. Don't re-arm a sent reminder

Each client treats a changed offset as a moved reminder, and clears `notificationSent` so it fires again (web `lib/tasks/crud/update.ts:103-107`, iOS `EditorMerge.swift:31-33`, Android `EditorRules.kt:34`). Resolving null to the number it already fires at isn't a move. **Compare effective values:** `old ?? default` against the new value. Otherwise, opening and saving an old task re-fires a reminder the user already saw.

## 5. Android's reminder row

Android's first row writes null. AND-36 relabeled it "Default reminder" from "None" (#41), because null fired the default. That row can't exist under this rule, and Android has no way to turn off a task's reminder: nothing in `app/` writes `notificationEnabled`.

**It becomes a real None, matching iOS and web.** The row writes `notificationEnabled = false` and keeps the number. Since `notification_enabled` syncs, None now means the same on every device, which null never could.

- Rows: None, then `ReminderOptions.including(notifyBefore)`.
- Label: None when `notificationEnabled` is false, otherwise the number's label. A legacy null with reminders on shows its default's label, as iOS does (`TaskEditorView.swift:472`), and saving writes that number.
- Picking an offset sets `notificationEnabled = true`.
- `reminderLabel` takes a non-null `Int`. `reminder_default` goes away, because Settings has its own string (`settings_default_reminder`), and `reminder_none` comes back.
- `TaskEditorDepthTest.aTaskWithNoReminderOffsetIsLabelledAsTheDefaultReminder` is replaced. #41 said this would happen.

## 6. Files

| | Web | iOS | Android |
|---|---|---|---|
| Resolve on write | `lib/tasks/crud/create.ts`, `update.ts`, `lib/tasks/import-export.ts` | `TaskStore.create`, `save`, `importTasks` | `TaskStore.add`, `update`, `edit`, `replaceAll` |
| Off keeps the number | `components/matrix-simplified/use-edit-draft-state.ts`, `savedReminder` | `App/Editor/TaskEditorView.swift:478,588,591,612`, `GSDModel/EditorMerge.swift:51` | `app/.../editor/EditorDepthSections.kt`, `ReminderSection` (section 5) |
| Wire | `lib/sync/task-mapper.ts:54,142`. Keep `:181` tolerant on read | `GSDWire/TaskWireMapper.swift:30`, `PocketBaseTaskRecord.swift:40`: write a non-optional `Int` | `core/sync/.../WireMapper.kt:39`, `WireTask.kt:51` |
| Drain (rule 2, write-back) | `lib/sync/pb-push.ts`, `upsertRemoteTask` | `GSDSync/SyncEngine.swift`, `push` | `core/sync/.../SyncEngine.kt`, `push` |
| Don't re-arm (section 4) | `lib/tasks/crud/update.ts:103` | `GSDModel/EditorMerge.swift:31-33` | `core/model/.../EditorRules.kt:34`, `ReminderPlanner.kt:101` |
| Other wire paths | None | **`GSDWire/DirectTaskPush.swift:52`**: the Share Extension creates a record directly, so `ShareExtension/ShareViewController.swift` passes the default from `TaskStore.readNotificationSettings` | None |
| Settings copy | `components/settings/notification-settings.tsx`: "Default reminder", helper "For new tasks" | `App/Settings/SettingsView.swift:280` | `app/.../settings/NotificationsGroup.kt` |

Make the mapper require the default as a parameter on all three. Then the compiler finds every wire path, including ones this table missed.

**MCP** (`packages/mcp-server/src/`). It has no queue, no stored rows, and no device settings.

- `types.ts:174` writes `?? 0`, so a task created over MCP with no offset reminds at the due time. Create now writes the shipped default, 15, which is also every client's seeded default (`write-ops/task-operations.ts:113`).
- Updates keep what they read, so they don't change. `types.ts:137` stays as it is.
- **Fix the wrong tool text.** `tools/schemas/write-tools.ts:75` and `:174` say "0 disables the reminder". `0` fires at the due time. The text should say so, and point to `notificationEnabled: false` for off.

**Docs:** add a line to `.claude/rules/pocketbase-sync.md`, and the owner updates the workspace `CLAUDE.md` contracts table.

## 7. Tests (red first)

The names stay the same on each client, so they can be compared. Android's `None` tests run on the emulator.

| Test | Rule | Web | iOS | Android |
|---|---|---|---|---|
| `a new task with no offset stores the default` | 2.1 | yes | yes | yes |
| `the wire never carries a null offset` (mapper, null in) | 2.2 | yes | yes | yes |
| `a zero offset stays zero and fires at the due time` | 2.3 | yes | yes | yes |
| `turning a reminder off keeps the offset` | 2.4 | yes | yes | yes |
| `changing the default doesn't move an existing number` | 2.5 | yes | yes | yes |
| `a legacy null fires the default until it's written` | 3 | yes | yes | yes |
| `any write of a legacy null pushes the resolved number` | 3 | yes | yes | yes |
| `a queued null payload pushes a number and stores it on the row, stamp unchanged` | 3 | yes | yes | yes |
| `a backup with no offset imports with the default` | 3 | yes | yes | yes |
| `resolving a null offset doesn't re-arm a sent reminder` | 4 | yes | yes | yes |
| `a real change to the offset still re-arms` | 4 | yes | yes | yes |
| `None turns the reminder off and syncs` | 5 | n/a | n/a | yes |
| `a shared task's direct push carries the default` | 6 | n/a | yes | n/a |
| `an MCP create with no offset writes 15`, `an MCP update keeps the stored offset` | 6 | MCP | | |

**One real-server run,** on a bare PocketBase 0.40.4 with no hooks, using the `pocketbase` lock: repeat `findings/D-10.md`'s table through each client's mapper. Cases A to D must all store the number that client sent, and clearing an offset must no longer leave `0` or an old value.

The existing web test `tests/data/sync/task-mapper.test.ts:146`, which expects `notify_before` to be null, flips.

## 8. Decided

Vinny said yes to all three on 2026-10-31 (`sprint/OWNER-DECISIONS.md` item 17).

1. **MCP create with no offset writes 15, where today it writes `0`.** That moves an agent-created task's reminder from the due time to 15 minutes before, and it matches a task created anywhere else.
2. **Android gains a real None (section 5).** Today nothing on Android turns off one task's reminder, so this is new behavior, not only a label.
3. **"For new tasks" goes under Default reminder.** It tells people a changed default won't move existing tasks.
