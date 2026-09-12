/**
 * Starts and stops a jam.
 *
 * Stream Deck cannot reassign a key's action while a game runs, so the
 * key decides on press instead: a jam in progress stops, and anything
 * else starts. The wording comes from CRG's own Label paths, which is
 * the same answer its operator console shows on its Start and Stop
 * buttons.
 */

import { action, type KeyDownEvent } from '@elgato/streamdeck';

import { type KeySpec } from '../render/key.ts';
import { CrgKeyAction } from './key-action.ts';
import { game, label } from '../crg/paths.ts';

const IN_JAM = game('InJam');

const START = label('Start');

const STOP = label('Stop');

const RUNNING_BACKGROUND = '#8c1d1d';

const READY_BACKGROUND = '#14532d';

const DISCONNECTED_BACKGROUND = '#26262b';

@action({ UUID: 'com.rcrderby.crg-streamdeck.jam-control' })
export class JamControl extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [IN_JAM, START, STOP];
  }

  protected override describe(): KeySpec {
    const connected = this.context.client.status === 'connected';
    const inJam = this.context.client.state.getBoolean(IN_JAM);

    const text = inJam
      ? this.context.client.state.getString(STOP, 'Stop Jam')
      : this.context.client.state.getString(START, 'Start Jam');

    const background = !connected ? DISCONNECTED_BACKGROUND : inJam ? RUNNING_BACKGROUND : READY_BACKGROUND;

    return {
      background,
      foreground: '#ffffff',
      texts: wrap(text).map((line, index, lines) => ({
        text: line,
        y: 56 + (index - (lines.length - 1) / 2) * 20,
        size: 17,
        weight: 'bold' as const,
        opacity: connected ? 1 : 0.45
      }))
    };
  }

  override onKeyDown(event: KeyDownEvent): void | Promise<void> {
    const inJam = this.context.client.state.getBoolean(IN_JAM);

    this.context.client.trigger(game(inJam ? 'StopJam' : 'StartJam'));

    return event.action.showOk();
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
