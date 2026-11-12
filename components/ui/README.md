# UI primitives

## Overview

This directory has the presentational primitives that the other component directories share.
It has `Badge`, `Button`, `Input`, `Label`, `Skeleton`, `Spinner`, `SegmentedControl`, and `DrawerHint`.
It wraps Radix for `Dialog`, `DropdownMenu`, `Switch`, and `Tooltip`.
It also has two toast systems: a Sonner `ThemedToaster` with a hotkey hint and focus return, and a context-based `ToastProvider` with `useToast`.

## Interface

- `Button` (`button.tsx`): `<button>` with `variant` (default `"primary"`), `type` (default `"button"`), and `ref`. Variants map to `btn-primary`, `btn-secondary`, `btn-ghost`, and `btn-danger`. It has no size prop.
- `ButtonProps` (`button.tsx`): button HTML attributes plus `variant?: "primary" | "subtle" | "ghost" | "destructive"`.
- `Badge` (`badge.tsx`): renders a `<span>` pill. `variant` defaults to `"default"`.
- `BadgeProps` (`badge.tsx`): span HTML attributes plus `variant?: "default" | "outline" | "ghost" | "accent"`.
- `Dialog` (`dialog.tsx`): alias of Radix `DialogPrimitive.Root`.
- `DialogOverlay` (`dialog.tsx`): styled Radix `Overlay` with `className` and `ref`.
- `DialogContent` (`dialog.tsx`): Radix `Content` inside a portal with an overlay. The extra prop `showCloseButton` (default `true`) renders a button labeled "Close".
- `DialogHeader` (`dialog.tsx`): `<div>` wrapper with `mb-4 space-y-1`.
- `DialogTitle`, `DialogDescription` (`dialog.tsx`): styled Radix `Title` and `Description`.
- `DrawerHint` (`drawer-hint.tsx`): props `{ shortcut = "Esc", action = "to cancel", className }`. It renders a `<kbd>` and action text, hidden on coarse pointers.
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`, `DropdownMenuRadioGroup` (`dropdown-menu.tsx`): aliases of Radix `Root`, `Trigger`, `Group`, `Portal`, `Sub`, and `RadioGroup`.
- `DropdownMenuContent` (`dropdown-menu.tsx`): Radix `Content` in a portal. `sideOffset` defaults to 4.
- `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSubTrigger` (`dropdown-menu.tsx`): styled Radix `Item`, `Label`, and `SubTrigger`, each with optional `inset`.
- `DropdownMenuSubContent`, `DropdownMenuSeparator` (`dropdown-menu.tsx`): styled Radix `SubContent` and `Separator`.
- `DropdownMenuCheckboxItem` (`dropdown-menu.tsx`): Radix `CheckboxItem` with a checkmark `ItemIndicator`. It takes `checked`.
- `DropdownMenuRadioItem` (`dropdown-menu.tsx`): Radix `RadioItem` with a dot `ItemIndicator`.
- `DropdownMenuShortcut` (`dropdown-menu.tsx`): `<span>` for shortcut text.
- `Input` (`input.tsx`): `<input>` with class `input w-full`. `type` defaults to `"text"`, and it accepts `ref`.
- `InputProps` (`input.tsx`): alias of `React.InputHTMLAttributes<HTMLInputElement>`.
- `Label` (`label.tsx`): styled `<label>` that accepts `ref`.
- `LabelProps` (`label.tsx`): alias of `React.LabelHTMLAttributes<HTMLLabelElement>`.
- `SegmentedControl` (`segmented-control.tsx`): generic over `T extends string`. Props are `{ options: readonly { value, label }[], value, onChange(value), label, className }`. It renders a fieldset of visually hidden radio inputs.
- `Skeleton` (`skeleton.tsx`): props `{ className }`. It renders an `animate-pulse` placeholder `<div>`.
- `Spinner` (`spinner.tsx`): props `{ className, size?: "sm" | "md" | "lg" }` (default `"md"`). It renders `<output aria-label="Loading">`.
- `Switch` (`switch.tsx`): styled Radix `SwitchPrimitives.Root` with a `Thumb`. It accepts Root props and `ref`.
- `ThemedToaster` (`themed-toaster.tsx`): takes no props. It renders the Sonner `Toaster` (`richColors`, `position="top-center"`) and `ToastActionHint`, and calls `useToastFocusReturn`.
- `TOAST_HOTKEY` (`toast-action-hint.tsx`): constant `["altKey", "KeyT"]`, passed to the Sonner `Toaster` `hotkey`.
- `ToastActionHint` (`toast-action-hint.tsx`): takes no props. It renders a hidden `role="status"` region that announces the hotkey when a Sonner toast has a string action label.
- `useToastFocusReturn` (`toast-focus-return.ts`): `() => void`. It restores focus after the toast hotkey when the previously focused element is gone.
- `useToast` (`toast.tsx`): returns `{ showToast(message, action?, duration?), hideToast(id) }` from `ToastContext`.
- `ToastProvider` (`toast.tsx`): props `{ children }`. It holds toast state, provides the context, and renders an announcement region and a bottom-right toast stack.
- `Tooltip`, `TooltipTrigger`, `TooltipProvider` (`tooltip.tsx`): aliases of Radix `Root`, `Trigger`, and `Provider`.
- `TooltipContent` (`tooltip.tsx`): Radix `Content` in a portal. `sideOffset` defaults to 4.

## Invariants

- `button.tsx:ButtonVariant`, `variantClasses`: `ButtonVariant` is exactly `"primary" | "subtle" | "ghost" | "destructive"`. `variantClasses` is `Record<ButtonVariant, string>`.
- `button.tsx:Button`: `type` defaults to `"button"` and `variant` defaults to `"primary"`.
- `badge.tsx:BadgeVariant`: is exactly `"default" | "outline" | "ghost" | "accent"`.
- `toast.tsx:useToast`: throws `Error("useToast must be used within ToastProvider")` when no provider is present.
- `toast.tsx:showToast`: the duration defaults to `TOAST_DURATION.LONG` from `@/lib/constants`. It schedules the auto-hide only when `duration > 0`.
- `toast.tsx:ToastItem.runAction`: a toast action click runs `action.onClick()`, then hides the toast.
- `themed-toaster.tsx:TOAST_TOP_OFFSET`, `TOAST_MOBILE_TOP_OFFSET`: the values are 80 and 130. A comment states that the toast sits below the measured top bars.
- `themed-toaster.tsx:ThemedToaster`: the Toaster theme is `resolvedTheme` only when hydrated and equal to `"dark"` or `"light"`. Otherwise it is `"system"`.
- `toast-action-hint.tsx:TOAST_HOTKEY`: a comment states that the hotkey and its spoken label (`TOAST_HOTKEY_LABEL = "Alt+T"`) live together, so the hint cannot name a key the Toaster ignores.
- `toast-action-hint.tsx:actionLabel`: a toast action that is a React element, or whose label is not a string, yields no hint.
- `toast-focus-return.ts:isHotkey`: the hotkey match is `event.altKey && event.code === TOAST_HOTKEY[1]`.
- `toast-focus-return.ts:restore`, `isFocusLost`: restores focus only while pending and when `document.activeElement` is `null` or `document.body`.
- `toast-focus-return.ts:restore`: the target is the remembered element if `isConnected`. Otherwise it is the element with id `main-content` (`MAIN_REGION_ID`).
- `toast-focus-return.ts:remember`: a hotkey press while focus is inside the toaster (`section[aria-label^='Notifications']`) does not start tracking.
- `toast-focus-return.ts:forget`: tracking stops when focus lands on a node outside the toaster.
- `switch.tsx:Switch`: a comment states that the off state needs a 3:1 control boundary (WCAG 1.4.11). Coarse pointers get a 44px pseudo-element target.
- `segmented-control.tsx:SegmentedControl`: the radios share one `name` from `useId()`. The selected option is `value === option.value`.
- `dropdown-menu.tsx:DropdownMenuSubTrigger`: a comment states that it uses the same focus and open surface as `DropdownMenuItem`. Solid tide behind ink fell to 2.6:1.
- `dialog.tsx:DialogContent`: renders the Close button only when `showCloseButton` is true.

## Side Effects

- `toast.tsx:showToast`: calls `setTimeout(() => hideToast(id), duration)` when `duration > 0`. Nothing clears the timer.
- `toast-focus-return.ts:useToastFocusReturn`: adds a window `keydown` listener (capture phase) and a document `focusin` listener. Unmount removes both.
- `toast-focus-return.ts:createFocusReturn.remember`: creates a `MutationObserver` on `document.body` with `{ childList: true, subtree: true }` on the hotkey. `stop` disconnects it.
- `toast-focus-return.ts:createFocusReturn.restore`: calls `target?.focus()` on the remembered element or on `document.getElementById("main-content")`.
- `toast-focus-return.ts:findToaster`: queries `document.querySelector("section[aria-label^='Notifications']")`.
- `themed-toaster.tsx:ThemedToaster`: calls `useTheme` from `next-themes` and `useIsHydrated` from `@/lib/use-is-hydrated`.
- `toast-action-hint.tsx:ToastActionHint`: reads Sonner toast state with `useSonner()`.
- `dialog.tsx:DialogContent`, `dropdown-menu.tsx:DropdownMenuContent`, `tooltip.tsx:TooltipContent`: render through a Radix `Portal`.

## Verification

- Run: `bun run test`
- UI tests live in `tests/ui/`. Do not use `bun test`, which starts Bun's built-in runner.
