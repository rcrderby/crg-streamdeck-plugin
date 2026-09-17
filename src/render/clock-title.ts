/** The title a clock key shows above the time. */

import { type ClockName } from '../crg/paths.ts';

/**
 * The clocks CRG numbers in a way an official reads aloud.
 *
 * A period is "Period 2" and a jam is "Jam 14". The lineup, timeout,
 * and intermission clocks carry a number too, but nobody calls a
 * timeout by its number, so those titles show none.
 */
const NUMBERED: Readonly<Partial<Record<ClockName, boolean>>> = {
  Period: true,
  Jam: true
};

/**
 * The title for a clock, carrying its number where CRG counts one.
 *
 * CRG can rename a clock while it runs: after a timeout, the lineup
 * clock is called "Post Timeout". The title follows the name CRG gives,
 * and falls back to the clock's own name when CRG has sent none.
 */
export function clockTitle(name: ClockName, number: number, crgName = ''): string {
  const title = (crgName.trim() || name).toUpperCase();

  return NUMBERED[name] === true && number > 0 ? `${title} ${number}` : title;
}
