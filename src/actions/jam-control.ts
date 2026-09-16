/**
 * Runs the jam and timeout controls from one key, over the clock that moment runs on.
 *
 * Stream Deck cannot reassign a key's action while a game runs, so the
 * key reads what CRG says is available and does that. CRG writes '---'
 * into a Label when its own button cannot be used, which is how a
 * timeout shows up: Label(Start) holds '---' while Label(Stop) reads
 * 'End Timeout'.
 */

import { CLOCK_NAMES, type ClockName, clock, game, isUnavailable, label, rule } from '../crg/paths.ts';
import { jamControlClock, lineupWarning } from '../crg/game-state.ts';
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
      running === undefined ? '' : this.#clockName(running),
      background,
      !available
    );
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
   * CRG offers both controls during a timeout, where ending the timeout
   * comes first; Start Jam is then the key that appears once the lineup
   * runs. So whichever stop CRG names wins while it is available.
   */
  #choose(): Choice {
    const state = this.context.client.state;

    const startText = state.getString(START);
    const stopText = state.getString(STOP);

    if (!isUnavailable(stopText)) {
      return { text: stopText, path: game('StopJam'), stopping: true };
    }

    if (!isUnavailable(startText)) {
      return { text: startText, path: game('StartJam'), stopping: false };
    }

    return { text: 'Wait', path: undefined, stopping: false };
  }
}
