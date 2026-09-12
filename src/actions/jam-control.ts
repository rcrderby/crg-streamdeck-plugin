/**
 * Runs the jam and timeout controls from one key.
 *
 * Stream Deck cannot reassign a key's action while a game runs, so the
 * key reads what CRG says is available and does that. CRG writes '---'
 * into a Label when its own button cannot be used, which is how a
 * timeout shows up: Label(Start) holds '---' while Label(Stop) reads
 * 'End Timeout'.
 */

import { action, type KeyDownEvent } from '@elgato/streamdeck';

import { type KeySpec } from '../render/key.ts';
import { CrgKeyAction } from './key-action.ts';
import { game, isUnavailable, label } from '../crg/paths.ts';

const IN_JAM = game('InJam');

const START = label('Start');

const STOP = label('Stop');

/** What the key does when pressed, and what it says. */
type Choice = {
  readonly text: string;
  readonly path: string | undefined;
  readonly stopping: boolean;
};

const STOPPING_BACKGROUND = '#8c1d1d';

const STARTING_BACKGROUND = '#14532d';

const IDLE_BACKGROUND = '#26262b';

@action({ UUID: 'com.rcrderby.crg-streamdeck.jam-control' })
export class JamControl extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [IN_JAM, START, STOP];
  }

  protected override describe(): KeySpec {
    const connected = this.context.client.status === 'connected';
    const choice = this.#choose();
    const available = connected && choice.path !== undefined;

    const background = !available ? IDLE_BACKGROUND : choice.stopping ? STOPPING_BACKGROUND : STARTING_BACKGROUND;

    const lines = wrap(connected ? choice.text : 'No CRG');

    return {
      background,
      foreground: '#ffffff',
      texts: lines.map((line, index) => ({
        text: line,
        y: 56 + (index - (lines.length - 1) / 2) * 20,
        size: 17,
        weight: 'bold' as const,
        opacity: available ? 1 : 0.45
      }))
    };
  }

  override onKeyDown(event: KeyDownEvent): void | Promise<void> {
    const choice = this.#choose();

    if (choice.path === undefined) {
      return event.action.showAlert();
    }

    this.context.client.trigger(choice.path);

    return event.action.showOk();
  }

  /**
   * Decides what the key does from the labels CRG computes.
   *
   * When both controls are available, the jam clock decides, which is
   * what CRG's own jam timer page shows.
   */
  #choose(): Choice {
    const state = this.context.client.state;

    const startText = state.getString(START);
    const stopText = state.getString(STOP);

    const canStart = !isUnavailable(startText);
    const canStop = !isUnavailable(stopText);

    if (canStart && canStop) {
      const inJam = state.getBoolean(IN_JAM);

      return inJam
        ? { text: stopText, path: game('StopJam'), stopping: true }
        : { text: startText, path: game('StartJam'), stopping: false };
    }

    if (canStop) {
      return { text: stopText, path: game('StopJam'), stopping: true };
    }

    if (canStart) {
      return { text: startText, path: game('StartJam'), stopping: false };
    }

    return { text: 'Wait', path: undefined, stopping: false };
  }
}

/** Breaks a CRG label into the two lines a key has room for. */
function wrap(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return words.length === 0 ? [''] : words;
  }

  const middle = Math.ceil(words.length / 2);

  return [words.slice(0, middle).join(' '), words.slice(middle).join(' ')];
}
