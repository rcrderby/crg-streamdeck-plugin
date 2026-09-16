import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { FakeDeck, PEDAL, type FakeKey } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import { OfficialTimeout, Timeout, Undo } from './game-controls.ts';
import { game, label } from '../crg/paths.ts';
import { replaceOnUndo } from '../crg/operators.ts';

/** CRG's own way of saying a control cannot be used now. */
const NONE = '---';

const REPLACE_SETTING = replaceOnUndo('StreamDeck');

describe('the timeout keys', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('call the timeout CRG calls it', async () => {
    const keyAction = new Timeout(deck.context);

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: game('Timeout'), value: true, flag: '' }]);
  });

  it('call an official timeout on its own control', async () => {
    const keyAction = new OfficialTimeout(deck.context);

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: game('OfficialTimeout'), value: true, flag: '' }]);
  });
});

describe('the Undo key', () => {
  let deck: FakeDeck;
  let keyAction: Undo;
  let key: FakeKey;

  /** Holds the key for the full second, which is what makes it act. */
  async function holdFully(on: FakeKey = key, settings = {}): Promise<void> {
    await deck.holdDown(keyAction, on, settings);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
  }

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new Undo(deck.context);
    deck.hold({ [label('Undo')]: 'Undo' });
    key = deck.place(keyAction);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('undoes on its own once held, while CRG is not set to offer a replacement', async () => {
    await holdFully();

    assert.deepEqual(deck.written, [{ key: game('ClockUndo'), value: true, flag: '' }]);
    assert.deepEqual(deck.switched, []);
  });

  it('does nothing when CRG has nothing to undo', async () => {
    deck.hold({ [label('Undo')]: NONE });
    deck.draw();

    await holdFully();

    assert.deepEqual(deck.written, []);
  });

  it('asks CRG to wait for a replacement and opens the page, when CRG is set to replace on undo', async () => {
    deck.hold({ [REPLACE_SETTING]: true });
    deck.draw();

    await holdFully();

    assert.deepEqual(deck.written, [{ key: game('ClockReplace'), value: true, flag: '' }]);
    assert.deepEqual(deck.switched, [{ deviceId: 'device-1', profile: 'profiles/undo-xl' }]);
  });

  it('only opens the page when CRG is already waiting, so the deck answers nothing by itself', async () => {
    deck.hold({ [REPLACE_SETTING]: true, [label('Replaced')]: 'Start Jam' });
    deck.draw();

    await holdFully();

    assert.deepEqual(deck.written, []);
    assert.deepEqual(deck.switched, [{ deviceId: 'device-1', profile: 'profiles/undo-xl' }]);
  });

  it('undoes plainly on a model that ships no Undo page', async () => {
    deck.hold({ [REPLACE_SETTING]: true });

    const pedal = deck.place(keyAction, {}, PEDAL);

    await holdFully(pedal);

    assert.deepEqual(deck.written, [{ key: game('ClockUndo'), value: true, flag: '' }]);
    assert.deepEqual(deck.switched, []);
  });

  it('follows CRG rather than what the key was last set to', async () => {
    deck.hold({ [REPLACE_SETTING]: false });
    deck.draw();

    await holdFully(key, { replaceOnUndo: true });

    assert.deepEqual(deck.written, [{ key: game('ClockUndo'), value: true, flag: '' }]);
  });

  it('writes the switch to the operator profile CRG keeps the setting under', () => {
    deck.resettle(keyAction, key, { replaceOnUndo: true });

    assert.deepEqual(deck.written, [{ key: REPLACE_SETTING, value: true, flag: '' }]);
  });

  it('writes nothing when the switch already matches what CRG holds', () => {
    deck.hold({ [REPLACE_SETTING]: true });
    deck.draw();
    deck.written.length = 0;

    deck.resettle(keyAction, key, { replaceOnUndo: true });

    assert.deepEqual(deck.written, []);
  });

  it('shows what CRG holds in every key’s settings, so the switch reads the scoreboard', () => {
    deck.hold({ [REPLACE_SETTING]: true });
    deck.draw();

    assert.deepEqual(key.saved.at(-1), { replaceOnUndo: true });
  });

  it('moves to the profile the connection settings choose', async () => {
    deck.operator.set('Rose_City');
    deck.hold({ [replaceOnUndo('Rose_City')]: true });
    deck.draw();

    await holdFully();

    assert.deepEqual(deck.written, [{ key: game('ClockReplace'), value: true, flag: '' }]);
  });
});
