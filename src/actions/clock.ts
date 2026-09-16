/**
 * Displays one CRG clock.
 *
 * Which clock a key shows is a setting, so the same action covers the
 * period, jam, lineup, timeout, and intermission clocks. The title uses
 * the name CRG gives the clock, so the lineup clock reads Post Timeout
 * after a timeout ends.
 */

import { action } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { CLOCK_NAMES, type ClockName, clock } from '../crg/paths.ts';
import { type KeySpec } from '../render/key.ts';
import { CrgKeyAction, isOnline } from './key-action.ts';
import { clockKey } from '../render/designs.ts';
import { clockTitle } from '../render/clock-title.ts';
import { formatClock } from '../render/time.ts';

export type ClockSettings = JsonObject & {
  clock?: ClockName;
};

@action({ UUID: 'com.rcrderby.crg-streamdeck.clock' })
export class Clock extends CrgKeyAction<ClockSettings> {
  protected override watchedPaths(): readonly string[] {
    return CLOCK_NAMES.flatMap((name) => [
      clock(name, 'Time'),
      clock(name, 'Number'),
      clock(name, 'Running'),
      clock(name, 'Name')
    ]);
  }

  protected override describe(settings: ClockSettings): KeySpec {
    const name = settings.clock ?? 'Jam';
    const state = this.context.client.state;

    return clockKey(
      clockTitle(name, state.getNumber(clock(name, 'Number'), 0), state.getString(clock(name, 'Name'))),
      isOnline(this.context.client.status) ? formatClock(state.getNumber(clock(name, 'Time'))) : '--:--',
      state.getBoolean(clock(name, 'Running'))
    );
  }
}
