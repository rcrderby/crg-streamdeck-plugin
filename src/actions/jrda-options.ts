/**
 * JRDA Options: Continuation Upcoming or Sudden Scoring, chosen in the key's settings.
 *
 * Continuation Upcoming sets CRG's flag for continuing a jam that
 * stopped for an injury, with a one second hold, and shows the time the
 * continued jam would run. Sudden Scoring only shows whether CRG has the
 * period in sudden scoring, which CRG decides for itself.
 */

import type { KeyAction } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { JAM_DURATIONS, clock, game, rule, team } from '../crg/paths.ts';
import { continuationAvailable, continuationTime, suddenScoring } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { continuationKey, suddenScoringKey } from '../render/designs.ts';
import { formatClock } from '../render/time.ts';
import { HoldKeyAction } from './hold-key-action.ts';

export type JrdaOption = 'continuation' | 'suddenScoring';

export type JrdaSettings = JsonObject & {
  option?: JrdaOption | string;
};

/** The flag a continuation sets, on the jam about to start. */
const UPCOMING = game('InjuryContinuationUpcoming');

/** The option a key is set to, defaulting to Continuation Upcoming. */
export function jrdaOptionOf(settings: JrdaSettings): JrdaOption {
  return settings.option === 'suddenScoring' ? 'suddenScoring' : 'continuation';
}

export class JrdaOptions extends HoldKeyAction<JrdaSettings> {
  protected override watchedPaths(): readonly string[] {
    return [
      UPCOMING,
      game('InSuddenScoring'),
      game('CurrentPeriodNumber'),
      rule('Jam.SuddenScoring'),
      rule('Jam.InjuryContinuation'),
      team(1, 'Injury'),
      clock('Jam', 'Number'),
      clock('Jam', 'MaximumTime'),
      JAM_DURATIONS
    ];
  }

  /** Only Continuation Upcoming acts, and only while a continuation can be called. */
  protected override canHold(settings: JrdaSettings): boolean {
    return jrdaOptionOf(settings) === 'continuation' && continuationAvailable(this.context.client.state);
  }

  protected override describe(settings: JrdaSettings, actionId: string): KeySpec {
    const state = this.context.client.state;

    if (jrdaOptionOf(settings) === 'suddenScoring') {
      return suddenScoringKey(suddenScoring(state));
    }

    const time = continuationTime(state);
    const level = this.holdDone(actionId) ? 0 : this.holdLevel(actionId);

    return continuationKey(
      time === undefined ? undefined : formatClock(time, true),
      this.shownValue(actionId, state.getBoolean(UPCOMING)),
      continuationAvailable(state),
      level
    );
  }

  /** Flips the continuation flag, and shows the value set until CRG sends it back. */
  protected override completeHold(action: KeyAction<JrdaSettings>): void {
    const value = !this.context.client.state.getBoolean(UPCOMING);

    this.awaitValue(action, value);
    this.context.client.set(UPCOMING, value);
  }
}
