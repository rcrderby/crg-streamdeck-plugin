/**
 * Clock formatting.
 *
 * CRG holds a clock as milliseconds. A scoreboard operator reads it as
 * minutes and seconds, so that is what a key shows.
 */

/** Formats milliseconds as a scoreboard clock, such as '1:23'. */
export function formatClock(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);

  const body = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : body;
}

/**
 * Reads a clock CRG holds as text, such as a rule's '0:30', in milliseconds.
 *
 * A value that does not read as a clock comes back as 0, which every
 * caller treats as the rule not being held.
 */
export function parseClock(text: string): number {
  const parts = text.trim().split(':');

  if (parts.length === 0 || parts.length > 3 || parts.some((part) => !/^\d+$/.test(part))) {
    return 0;
  }

  return parts.reduce((total, part) => total * 60 + Number(part), 0) * 1000;
}

/**
 * How often a clock is worth redrawing.
 *
 * A running clock changes the text it shows once a second, so it asks
 * to be redrawn on that beat rather than on every message CRG sends.
 */
export function clockRedrawIntervalMs(): number {
  return 1000;
}
