/**
 * The pulse on the mark a running team timeout or official review used.
 *
 * Stream Deck does not animate a key by itself, so the key is redrawn
 * with the mark's opacity at each moment of the pulse.
 */

export const PULSE_MS = 1600;

/**
 * The pulse on a lineup that has run long: one full swing every two seconds.
 *
 * It is a whole number of seconds, so it keeps time with the clock beside
 * it rather than drifting against it.
 */
export const LINEUP_PULSE_MS = 2000;

export const PULSE_FAINTEST = 0.2;

/** How far through a pulse a moment is: 0 at each end, 1 halfway. */
export function pulsePhase(now: number, period = PULSE_MS): number {
  const phase = (((now % period) + period) % period) / period;

  return Math.round(((1 - Math.cos(2 * Math.PI * phase)) / 2) * 100) / 100;
}

/** The mark's opacity at a moment: full at the start of each pulse, faintest halfway through. */
export function pulseOpacity(now: number): number {
  const level = 1 - (1 - PULSE_FAINTEST) * pulsePhase(now);

  return Math.round(level * 100) / 100;
}
