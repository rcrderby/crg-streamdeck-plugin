import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import type { JsonObject } from '@elgato/utils';
import type { SingletonAction } from '@elgato/streamdeck';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import { ReplaceChoice, ReplaceConfirm, ReplaceInfo } from './replace-page.ts';
import { game, label } from '../crg/paths.ts';

/** CRG's own way of saying a control cannot be used now. */
const NONE = '---';

/** CRG waiting to replace a stopped jam, with the two controls it allows in its place. */
const WAITING = {
  [label('Replaced')]: 'Stop Jam',
  [label('Start')]: 'Start Jam',
  [label('Stop')]: NONE,
  [label('Timeout')]: 'Timeout',
  [label('Undo')]: 'No Action'
};

describe('the Undo page', () => {
  let deck: FakeDeck;

  /** Holds a key for the full second, which is what makes it act. */
  async function holdFully<T extends JsonObject>(
    keyAction: SingletonAction<T>,
    key: FakeKey<T>,
    settings: T = {} as T
  ): Promise<void> {
    await deck.holdDown(keyAction, key, settings);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
  }

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    deck.hold(WAITING);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('leaves the page as soon as CRG closes its replace menu, whoever closed it', () => {
    const keyAction = new ReplaceInfo(deck.context);

    deck.place(keyAction);

    assert.deepEqual(deck.switched, []);

    deck.hold({ [label('Replaced')]: NONE });

    assert.deepEqual(deck.switched, [{ deviceId: 'device-1', profile: undefined }]);
  });

  it('stays on the page while CRG is still waiting', () => {
    const keyAction = new ReplaceInfo(deck.context);

    deck.place(keyAction);
    deck.hold({ [label('Replaced')]: 'Start Jam' });

    assert.deepEqual(deck.switched, []);
  });

  it('answers with No Action from the key that carries CRG’s own Undo', async () => {
    const keyAction = new ReplaceConfirm(deck.context);

    await holdFully(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: game('ClockReplace'), value: true, flag: '' }]);
  });

  it('fills its choices from the controls CRG allows, in CRG’s own order', async () => {
    const keyAction = new ReplaceChoice(deck.context);

    await holdFully(keyAction, deck.place(keyAction, { slot: 0 }), { slot: 0 });

    assert.deepEqual(deck.written, [{ key: game('StartJam'), value: true, flag: '' }]);

    deck.written.length = 0;

    await holdFully(keyAction, deck.place(keyAction, { slot: 1 }), { slot: 1 });

    assert.deepEqual(deck.written, [{ key: game('Timeout'), value: true, flag: '' }]);
  });

  it('leaves a choice CRG does not offer blank, and does nothing when it is pressed', async () => {
    const keyAction = new ReplaceChoice(deck.context);
    const key = deck.place(keyAction, { slot: 2 });

    await holdFully(keyAction, key, { slot: 2 });

    assert.deepEqual(deck.written, []);
    assert.equal(key.alerts, 0);
  });

  it('offers nothing at all once CRG is no longer waiting', async () => {
    const keyAction = new ReplaceChoice(deck.context);
    const key = deck.place(keyAction, { slot: 0 });

    deck.hold({ [label('Replaced')]: NONE });
    deck.draw();

    await holdFully(keyAction, key, { slot: 0 });

    assert.deepEqual(deck.written, []);
  });
});
