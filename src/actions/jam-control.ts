/**
 * Runs the jam and timeout controls from one key, over the clock that moment runs on.
 *
 * Stream Deck cannot reassign a key's action while a game runs, so the
 * key reads what CRG says is available and does that. CRG writes '---'
 * into a Label when its own button cannot be used, which is how a
 * timeout shows up: Label(Start) holds '---' while Label(Stop) reads
 * 'End Timeout'.
 */

import { CLOCK_NAMES, TIMEOUTS, type ClockName, clock, game, isUnavailable, label, rule } from '../crg/paths.ts';
import { jamControlClock, lineupWarning, runningTimeout } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { JAM_IDLE, JAM_STOP, jamControlKey, lineupBackground } from '../render/designs.ts';
import { clockTitle } from '../render/clock-title.ts';
import { SECOND_PULSE_MS, pulsePhase } from '../render/pulse.ts';
import { formatClock } from '../render/time.ts';
import { CrgKeyAction, isOnline } from './key-action.ts';

const IN_JAM = game('InJam');

const START = label('Start');

const STOP = label('Stop');

/** What the key does when pressed, and what it says. */
type Choice = {
  readonly text: string;
  readonly path: string | undefined;
  readonly stopping: boolean;
};

export class JamControl extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [
      IN_JAM,
      START,
      STOP,
      TIMEOUTS.running,
      rule('Lineup.Duration'),
      ...CLOCK_NAMES.flatMap((name) => [
        clock(name, 'Time'),
        clock(name, 'Running'),
        clock(name, 'Direction'),
        clock(name, 'InvertedTime'),
        clock(name, 'Name'),
        clock(name, 'Number')
      ])
    ];
  }

  protected override describe(): KeySpec {
    // Every key reads the game while a write is refused, so this one
    // does too rather than reading No CRG beside clocks that are live.
    const online = isOnline(this.context.client.status);
    const choice = this.#choose();
    const available = online && choice.path !== undefined;

    const background = !available
      ? JAM_IDLE
      : choice.stopping
        ? JAM_STOP
        : lineupBackground(lineupWarning(this.context.client.state), pulsePhase(Date.now(), SECOND_PULSE_MS));

    const running = online ? jamControlClock(this.context.client.state, choice.stopping) : undefined;

    return jamControlKey(
      online ? choice.text : 'No CRG',
      running === undefined ? undefined : this.#time(running),
      online ? this.#foot(running) : '',
      background,
      !available
    );
  }

  /**
   * The foot line: the jam CRG holds, and the clock's own name beside it.
   *
   * A jam clock already names its jam, so it says it alone. A lineup says
   * both, since the number belongs to the jam that just ran and the name
   * to the clock counting now. CRG numbers jams within a period, so
   * before the first jam of one there is no jam to name.
   */
  #foot(running: ClockName | undefined): string {
    const number = this.context.client.state.getNumber(clock('Jam', 'Number'));
    const jam = number > 0 ? `JAM ${number}` : '';

    if (running === 'Jam') {
      return this.#clockName(running);
    }

    if (running === 'Lineup') {
      return jam === '' ? this.#clockName(running) : `${jam} \u00b7 ${this.#clockName(running)}`;
    }

    return jam;
  }

  /** Start Jam moves between green and orange once the lineup is over its time. */
  protected override animates(): boolean {
    return lineupWarning(this.context.client.state) === 'over';
  }

  /** What CRG calls that clock, which reads Post Timeout after a timeout. */
  #clockName(running: ClockName): string {
    const state = this.context.client.state;

    return clockTitle(running, state.getNumber(clock(running, 'Number'), 0), state.getString(clock(running, 'Name')));
  }

  /** A key CRG has nothing for does nothing, and already reads as dimmed. */
  override onKeyDown(): void {
    const choice = this.#choose();

    if (choice.path !== undefined) {
      this.context.client.trigger(choice.path);
    }
  }

  /** The time on the clock the key's own action runs against. */
  #time(running: ClockName): string {
    return formatClock(this.context.client.state.getNumber(clock(running, 'Time')));
  }

  /**
   * Decides what the key does from the labels CRG computes.
   *
   * CRG's stop control carries four meanings. Two of them end something
   * that is running, a jam or a timeout, and those come first, which is
   * how CRG's own screen puts ending a timeout ahead of starting a jam.
   * The other two offer to start the lineup clock while nothing runs at
   * all, before the game and once an intermission is over, and the key
   * leads with the jam there rather than with a clock nobody is waiting
   * on.
   */
  #choose(): Choice {
    const state = this.context.client.state;

    const startText = state.getString(START);
    const stopText = state.getString(STOP);
    const ending = state.getBoolean(IN_JAM) || runningTimeout(state).kind !== 'none';

    if (ending && !isUnavailable(stopText)) {
      return { text: stopText, path: game('StopJam'), stopping: true };
    }

    if (!isUnavailable(startText)) {
      return { text: startText, path: game('StartJam'), stopping: false };
    }

    return { text: 'Wait', path: undefined, stopping: false };
  }
}
