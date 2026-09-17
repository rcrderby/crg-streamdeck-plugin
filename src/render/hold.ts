/**
 * How long a key that confirms something must be held, and how far along a hold is.
 *
 * A hold keeps a stray press from undoing a clock action, disconnecting
 * the deck, or choosing what replaces an undone action.
 */

export const HOLD_MS = 1000;

/** How far along a hold that started at one time is at another, from 0 to 1. */
export function holdProgress(startedAt: number, now: number): number {
  return Math.min(1, Math.max(0, (now - startedAt) / HOLD_MS));
}
