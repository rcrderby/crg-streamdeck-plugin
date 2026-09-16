import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import { Lead, LostLead, NoPivot, StarPass } from './team-flags.ts';
import { type TeamSettings } from './team-key-action.ts';
import { team } from '../crg/paths.ts';

describe('the jam flag keys', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('set the flag when it is off', async () => {
    const keyAction = new Lead(deck.context);

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: team(1, 'Lead'), value: true, flag: '' }]);
  });

  it('clear the flag when CRG holds it on', async () => {
    const keyAction = new Lead(deck.context);

    deck.hold({ [team(1, 'Lead')]: true });

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: team(1, 'Lead'), value: false, flag: '' }]);
  });

  it('write to the team the key is set to', async () => {
    const keyAction = new NoPivot(deck.context);
    const settings: TeamSettings = { team: 2 };

    await deck.press(keyAction, deck.place(keyAction, settings), settings);

    assert.deepEqual(deck.written, [{ key: team(2, 'NoPivot'), value: true, flag: '' }]);
  });

  it('leave Star Pass alone while the team skates without a pivot, which CRG ignores', async () => {
    const keyAction = new StarPass(deck.context);

    deck.hold({ [team(1, 'NoPivot')]: true });

    const key = deck.place(keyAction);

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, []);
    assert.equal(key.alerts, 0);
  });
});

describe('the Lost Lead key', () => {
  let deck: FakeDeck;
  let keyAction: LostLead;
  let key: FakeKey<TeamSettings>;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new LostLead(deck.context);
    key = deck.place(keyAction);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('does nothing on a press, since it sits beside Lead and undoes it', async () => {
    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, []);
  });

  it('marks the lead lost once held for the full second', async () => {
    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [{ key: team(1, 'Lost'), value: true, flag: '' }]);
  });

  it('gives the lead back when CRG already holds it lost', async () => {
    deck.hold({ [team(1, 'Lost')]: true });

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [{ key: team(1, 'Lost'), value: false, flag: '' }]);
  });

  it('fills its top bar as the hold runs, and drops it the moment the hold acts', async () => {
    const atRest = key.image;

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS / 2);
    deck.draw();

    assert.notEqual(key.image, atRest, 'a hold in progress should show');

    mock.timers.tick(HOLD_MS / 2);
    await setImmediate();
    deck.draw();

    assert.equal(key.image, atRest, 'a hold that has acted should show nothing of itself');
  });
});
