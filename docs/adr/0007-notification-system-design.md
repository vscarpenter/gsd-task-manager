# 0007: Browser Notification System Design

**Date:** 2026-04-14
**Status:** Accepted
**Deciders:** Vinny Carpenter

## Context

Users need reminders for tasks with due dates or `notifyBefore` settings. The app is client-side-only (ADR-0001) with no server, so any notification mechanism must run entirely in the browser. Notifications should work when the tab is backgrounded but not when the browser is closed, which is acceptable given the PWA use case.

## Decision

Use the browser Notification API with a modular implementation in `lib/notifications/` split across four files: `display.ts` (creating and showing notifications), `permissions.ts` (requesting and checking notification permission state), `settings.ts` (reading/writing per-task notification preferences from IndexedDB), and `badge.ts` (updating the PWA app icon badge count via the Badging API). A periodic check (driven by the app's active tab, not a background push service) evaluates tasks whose `notifyBefore` window has elapsed and fires notifications via the Service Worker's `showNotification()` for persistence across tab backgrounds. The `notificationSent` IndexedDB index prevents duplicate alerts for the same task/due-date combination. User permission is requested lazily — only when the user first enables notifications in Settings, never on cold start.

## Consequences

### Easier
- Zero server infrastructure — notifications are entirely client-driven.
- Modular split keeps each concern (display, permissions, settings, badge) independently testable.
- The `notificationSent` index makes deduplication a single indexed lookup rather than a full table scan.
- Lazy permission prompting respects user agency and browser best-practice guidelines.
- Badge count provides at-a-glance overdue task count on the installed PWA icon.

### Harder
- Notifications only fire while the browser is open; fully background (push) notifications are not supported without a server.
- Browser permission model is one-shot — if the user denies, re-prompting requires them to manually reset in browser settings.
- The Badging API has limited browser support (Chrome/Edge on desktop; not supported in Firefox or Safari).
- Periodic polling frequency is a trade-off between battery/CPU and notification timeliness.

## Alternatives Considered

- **Email notifications**: Would require user accounts and a server-side email service. Incompatible with the privacy-first, no-account baseline (ADR-0001). Rejected.
- **In-app only (no browser notifications)**: Requires the tab to be focused and visible, making it useless as a reminder. Rejected as insufficient.
- **Push notifications via server (Web Push/FCM)**: True background delivery, but requires a push server, VAPID keys, and user accounts. Rejected — too much infrastructure for an optional reminder feature; may revisit if a server tier is added.
- **System tray / desktop notifications via Electron**: Only applicable if an Electron wrapper is adopted (see ADR-0004). Rejected.
