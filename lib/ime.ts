/**
 * True while an input method (Japanese, Chinese, Korean, and others) owns the
 * keystroke. Enter then confirms a conversion, arrows move between candidates,
 * and Escape cancels, so a custom key handler must leave the key alone.
 *
 * `isComposing` alone misses Safari, which fires `compositionend` before the
 * keydown of the Enter that confirmed it. That keydown still reports keyCode
 * 229, so the deprecated property is the reliable fallback.
 *
 * React handlers pass `event.nativeEvent`; window listeners pass the event.
 */
export function isImeComposing(event: Pick<KeyboardEvent, "isComposing" | "keyCode">): boolean {
  return event.isComposing || event.keyCode === IME_PROCESS_KEY_CODE;
}

/** The keyCode browsers report for any keydown an IME is processing. */
const IME_PROCESS_KEY_CODE = 229;
