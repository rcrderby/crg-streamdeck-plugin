import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import {
  ClockDuringFinalScore,
  EndOfPeriod,
  OfficialScore,
  OvertimeLineup,
  PeriodEndTimeout
} from './end-of-period.ts';
import { game, label, rule, team } from '../crg/paths.ts';

/** The SVG a key was last drawn with, out of the data URI Stream Deck is sent. */
function drawn(key: FakeKey): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

function darkened(key: FakeKey): boolean {
  return drawn(key).includes('opacity="0.62"');
}

describe('the End of Period key', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('opens the End of Period page', async () => {
    const keyAction = new EndOfPeriod(deck.context);

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.switched, [{ deviceId: 'device-1', profile: 'profiles/end-of-period-xl' }]);
  });
});

describe('the Official Score key', () => {
  let deck: FakeDeck;
  let keyAction: OfficialScore;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new OfficialScore(deck.context);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('makes the score official once held for the full second', async () => {
    deck.hold({ [game('OfficialScore')]: false, [game('InhibitFinalScore')]: false });

    const key = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [{ key: game('OfficialScore'), value: true, flag: '' }]);
  });

  it('does nothing on a quick press', async () => {
    deck.hold({ [game('OfficialScore')]: false, [game('InhibitFinalScore')]: false });

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, []);
  });

  it('reads UNOFFICIAL with HOLD in its bar while it can be set', () => {
    deck.hold({ [game('OfficialScore')]: false, [game('InhibitFinalScore')]: false });

    const key = deck.place(keyAction);

    assert.match(drawn(key), />UNOFFICIAL</);
    assert.match(drawn(key), />HOLD</);
    assert.ok(!darkened(key));
  });

  it('is darkened, and ignores a hold, while CRG holds the score back', async () => {
    deck.hold({ [game('OfficialScore')]: false, [game('InhibitFinalScore')]: true });

    const key = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
    deck.draw();

    assert.deepEqual(deck.written, []);
    assert.ok(darkened(key));
    assert.match(drawn(key), />WAIT</);
  });

  it('counts down the wait it saw begin', () => {
    deck.hold({
      [game('OfficialScore')]: false,
      [game('InhibitFinalScore')]: true,
      [game('InJam')]: true,
      [rule('Lineup.Duration')]: '0:30',
      [team(1, 'OfficialReviews')]: 1
    });

    const key = deck.place(keyAction);

    deck.hold({ [game('InJam')]: false });
    mock.timers.tick(12_000);
    deck.draw();

    assert.match(drawn(key), />WAIT 0:18</);
  });

  it('stays set, and ignores a hold, once the score is official', async () => {
    deck.hold({ [game('OfficialScore')]: true, [game('InhibitFinalScore')]: false });

    const key = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
    deck.draw();

    assert.deepEqual(deck.written, []);
    assert.match(drawn(key), />OFFICIAL</);
    assert.match(drawn(key), /fill="#22c55e"/);
  });
});

describe('the Timeout Before Period End key', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('opens its page by way of the layout, with the seconds back at one', async () => {
    const keyAction = new PeriodEndTimeout(deck.context);

    deck.periodEndSeconds.step(10);
    await deck.press(keyAction, deck.place(keyAction));

    assert.equal(deck.periodEndSeconds.value, 1);
    assert.deepEqual(deck.switched, [
      { deviceId: 'device-1', profile: undefined },
      { deviceId: 'device-1', profile: 'profiles/period-end-timeout-xl' }
    ]);
  });
});

describe('the Start Overtime Lineup key', () => {
  let deck: FakeDeck;
  let keyAction: OvertimeLineup;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new OvertimeLineup(deck.context);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('starts the overtime lineup once held, while CRG offers it', async () => {
    deck.hold({ [label('Stop')]: 'Overtime Lineup', [game('InOvertime')]: false });

    const key = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [{ key: game('StartOvertime'), value: true, flag: '' }]);
  });

  it('is darkened, and ignores a hold, until CRG offers it', async () => {
    deck.hold({ [label('Stop')]: 'Lineup', [game('InOvertime')]: false });

    const key = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
    deck.draw();

    assert.deepEqual(deck.written, []);
    assert.ok(darkened(key));
  });

  it('reads IN OVERTIME with its bar green once the game is in overtime', () => {
    deck.hold({ [label('Stop')]: '---', [game('InOvertime')]: true });

    const key = deck.place(keyAction);

    assert.match(drawn(key), />IN OVERTIME</);
    assert.match(drawn(key), /fill="#22c55e"/);
    assert.ok(!darkened(key));
  });
});

describe('the Show Clock During Final Score key', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('flips CRG’s setting with a press', async () => {
    const keyAction = new ClockDuringFinalScore(deck.context);

    deck.hold({ [game('ClockDuringFinalScore')]: true });
    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: game('ClockDuringFinalScore'), value: false, flag: '' }]);
  });
});
