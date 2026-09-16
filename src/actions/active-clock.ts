/**
 * Mirrors the clock and label CRG's scoreboard shows: the period or the intermission.
 *
 * During a period the key shows the period clock. While the intermission
 * clock runs, it shows that clock, titled with CRG's label for the
 * moment: before the game, between periods, or after the game. Where the
 * scoreboard hides the time, and when no clock is running and it reads
 * Coming Up, the key shows the label alone.
 */

import { INTERMISSION_LABELS, type ClockName, clock, game, rule } from '../crg/paths.ts';
import { activeClock } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { CrgKeyAction, isOnline } from './key-action.ts';
import { clockKey } from '../render/designs.ts';
import { clockTitle } from '../render/clock-title.ts';
import { formatClock } from '../render/time.ts';

const SHOWN: readonly ClockName[] = ['Period', 'Intermission'];

export class ActiveClock extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [
      ...SHOWN.flatMap((name) => [
        clock(name, 'Time'),
        clock(name, 'Number'),
        clock(name, 'Running'),
        clock(name, 'Name')
      ]),
      game('InPeriod'),
      game('OfficialScore'),
      game('ClockDuringFinalScore'),
      rule('Period.Number'),
      ...Object.values(INTERMISSION_LABELS)
    ];
  }

  protected override describe(): KeySpec {
    const state = this.context.client.state;
    const choice = activeClock(state);

    const title =
      choice.label === undefined
        ? clockTitle('Period', state.getNumber(clock('Period', 'Number'), 0), state.getString(clock('Period', 'Name')))
        : choice.label.toUpperCase();

    const online = isOnline(this.context.client.status);
    const time = online ? formatClock(state.getNumber(clock(choice.clock, 'Time'))) : '--:--';

    return clockKey(
      title,
      choice.showTime ? time : undefined,
      choice.showTime && state.getBoolean(clock(choice.clock, 'Running'))
    );
  }
}
