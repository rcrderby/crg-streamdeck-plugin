/**
 * Displays one CRG clock.
 *
 * Which clock a key shows is a setting, so the same action covers the
 * period, jam, lineup, timeout, and intermission clocks.
 */

import { action } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { type KeySpec, type KeyText } from '../render/key.ts';
import { CLOCK_NAMES, type ClockName, clock } from '../crg/paths.ts';
import { CrgKeyAction } from './key-action.ts';
import { clockTitle } from '../render/clock-title.ts';
import { formatClock } from '../render/time.ts';

export type ClockSettings = JsonObject & {
  clock?: ClockName;
};

const RUNNING_ACCENT = '#22c55e';

const STOPPED_ACCENT = '#3f3f46';

@action({ UUID: 'com.rcrderby.crg-streamdeck.clock' })
export class Clock extends CrgKeyAction<ClockSettings> {
  protected override watchedPaths(): readonly string[] {
    return CLOCK_NAMES.flatMap((name) => [clock(name, 'Time'), clock(name, 'Number'), clock(name, 'Running')]);
  }

  protected override describe(settings: ClockSettings): KeySpec {
    const name = settings.clock ?? 'Jam';
    const state = this.context.client.state;

    const running = state.getBoolean(clock(name, 'Running'));
    const number = state.getNumber(clock(name, 'Number'), 0);
    const connected = this.context.client.status === 'connected';

    const texts: KeyText[] = [
      { text: clockTitle(name, number), y: 30, size: 13, weight: 'bold' as const, opacity: 0.75 },
      { text: connected ? formatClock(state.getNumber(clock(name, 'Time'))) : '--:--', y: 72, size: 30 }
    ];

    return {
      background: '#0b0b0f',
      foreground: '#ffffff',
      accent: running ? RUNNING_ACCENT : STOPPED_ACCENT,
      texts
    };
  }
}
