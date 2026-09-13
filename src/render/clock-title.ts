/**
 * The title a clock key shows above the time.
 *
 * This sits outside the action modules because Node strips types to run
 * the tests and cannot parse the decorators the actions carry, so
 * anything worth testing lives in a module without one.
 */

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
 * The number rides in the title rather than on a line of its own, so
 * the key does not say the same word twice.
 */
export function clockTitle(name: ClockName, number: number): string {
  const title = name.toUpperCase();

  return NUMBERED[name] === true && number > 0 ? `${title} ${number}` : title;
}
