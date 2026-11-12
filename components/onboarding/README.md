# Onboarding

## Overview

This directory has two client files for the welcome tour.
`onboarding-gate.tsx` decides when the tour opens. It uses a localStorage flag, the pathname, and a replay window event.
`onboarding.tsx` renders the four-screen tour dialog.

## Interface

- `ONBOARDING_SEEN_KEY` (`onboarding-gate.tsx`): string constant `"gsd-onboarding-seen"`. It is the localStorage flag that marks the tour as seen.
- `REPLAY_ONBOARDING_EVENT` (`onboarding-gate.tsx`): string constant `"gsd:replay-onboarding"`. It is the window event name that replays the tour.
- `OnboardingGate` (`onboarding-gate.tsx`): takes no props. It computes `open` and renders `Onboarding` with `onClose` and `onSignIn` handlers.
- `Onboarding` (`onboarding.tsx`): renders a `Dialog` that steps through four `SCREENS`. Props are `open: boolean`, `onClose: () => void`, and optional `onSignIn: () => void`.

## Invariants

- `onboarding-gate.tsx:OnboardingGate`: `open = forceOpen || (!suppressed && !seen)`.
- `onboarding-gate.tsx:SUPPRESS_PREFIXES`: the tour does not open by itself when `pathname` starts with `"/about"`. A replay (`forceOpen`) still opens there.
- `onboarding-gate.tsx:getSeenServerSnapshot`: the server snapshot always returns `true`, so the tour never opens during static prerendering.
- `onboarding-gate.tsx:getSeenSnapshot`: seen is `!!localStorage.getItem(ONBOARDING_SEEN_KEY)`. Any truthy stored value counts.
- `onboarding-gate.tsx:OnboardingGate`: a comment states that render derives the automatic open. Replay is explicit state because a window event drives it.
- `onboarding-gate.tsx:close`: focus returns to the replay trigger only if that element `isConnected`.
- `onboarding-gate.tsx:signIn`: calls `close()` before it dispatches `OPEN_SYNC_EVENT`.
- `onboarding-gate.tsx:subscribeToSeenFlag`: the `storage` handler reacts only when `event.key === ONBOARDING_SEEN_KEY`.
- `onboarding.tsx:Onboarding`: `onOpenChange` calls `onClose` only when `nextOpen` is false.
- `onboarding.tsx:Onboarding`: `OnboardingDialog` mounts only while `open` is true, so the screen index resets to 0 on each open.
- `onboarding.tsx:OnboardingDialog`: Next clamps the index with `Math.min(i + 1, SCREENS.length - 1)`. The dialog has no back control.
- `onboarding.tsx:OnboardingDialog`: "Start using GSD" renders only on the last screen. "Sign in to sync" also requires `onSignIn`.
- `onboarding.tsx:OnboardingDialog`: `DialogContent` renders with `showCloseButton={false}`. The component supplies its own "Skip" button, which calls `onClose`.

## Side Effects

- `onboarding-gate.tsx:markOnboardingSeen`: calls `localStorage.setItem("gsd-onboarding-seen", "true")`, then invokes every listener in the module-level `seenListeners` set.
- `onboarding-gate.tsx:getSeenSnapshot`: reads `localStorage.getItem("gsd-onboarding-seen")` on each snapshot.
- `onboarding-gate.tsx:subscribeToSeenFlag`: adds and removes a window `"storage"` listener. It also adds and removes `onChange` in `seenListeners`.
- `onboarding-gate.tsx:OnboardingGate`: an effect adds and removes a window listener for `"gsd:replay-onboarding"`. The handler captures `document.activeElement` and sets `forceOpen` to true.
- `onboarding-gate.tsx:close`: `window.setTimeout(() => replayTrigger.focus(), 0)` moves focus back to the replay trigger.
- `onboarding-gate.tsx:signIn`: calls `window.dispatchEvent(new Event(OPEN_SYNC_EVENT))`. The constant comes from `@/components/sync/open-sync-event` (see [sync](../sync/README.md)).
- `onboarding-gate.tsx:OnboardingGate`: reads the route with `usePathname` from `next/navigation`. This directory makes no router calls.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
