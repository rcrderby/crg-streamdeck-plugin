import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import { JrdaOptions, type JrdaSettings } from './jrda-options.ts';
import { clock, game, rule, team } from '../crg/paths.ts';

/** The SVG a key was last drawn with, out of the data URI Stream Deck is sent. */
function drawn(key: FakeKey<JrdaSettings>): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

const CONTINUATION: JrdaSettings = { option: 'continuation' };

const SUDDEN: JrdaSettings = { option: 'suddenScoring' };

const UPCOMING = game('InjuryContinuationUpcoming');

/** Tim's JRDA game, in the lineup after jam 1 of period 1 stopped for an injury 10.8 seconds in. */
const STOPPED_FOR_INJURY = {
  [rule('Jam.InjuryContinuation')]: 'true',
  [team(1, 'Injury')]: true,
  [team(2, 'Injury')]: true,
  [game('CurrentPeriodNumber')]: 1,
  [clock('Jam', 'Number')]: 1,
  [clock('Jam', 'MaximumTime')]: 120000,
  'ScoreBoard.CurrentGame.Period(1).Jam(1).Duration': 10800,
  [UPCOMING]: false
};

describe('Continuation Upcoming', () => {
  let deck: FakeDeck;
  let keyAction: JrdaOptions;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new JrdaOptions(deck.context);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('shows the time a continued jam would run, as CRG will start it', () => {
    deck.hold(STOPPED_FOR_INJURY);

    const key = deck.place(keyAction, CONTINUATION);

    deck.draw();

    assert.match(drawn(key), />1:50</);
    assert.match(drawn(key), />JAM TIME</);
  });

  it('counts from the jam clock’s maximum, so a second continuation comes out shorter', () => {
    deck.hold({
      ...STOPPED_FOR_INJURY,
      [clock('Jam', 'Number')]: 2,
      [clock('Jam', 'MaximumTime')]: 109200,
      'ScoreBoard.CurrentGame.Period(1).Jam(2).Duration': 30000
    });

    const key = deck.place(keyAction, CONTINUATION);

    deck.draw();

    assert.match(drawn(key), />1:20</);
  });

  it('sets the continuation once held for the full second', async () => {
    deck.hold(STOPPED_FOR_INJURY);

    const key = deck.place(keyAction, CONTINUATION);

    await deck.holdDown(keyAction, key, CONTINUATION);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [{ key: UPCOMING, value: true, flag: '' }]);
  });

  it('does nothing on a quick press', async () => {
    deck.hold(STOPPED_FOR_INJURY);

    await deck.press(keyAction, deck.place(keyAction, CONTINUATION), CONTINUATION);

    assert.deepEqual(deck.written, []);
  });

  it('does nothing, and is darkened, with no injury called', async () => {
    deck.hold({ ...STOPPED_FOR_INJURY, [team(1, 'Injury')]: false });

    const key = deck.place(keyAction, CONTINUATION);

    await deck.holdDown(keyAction, key, CONTINUATION);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
    deck.draw();

    assert.deepEqual(deck.written, []);
    assert.ok(drawn(key).includes('opacity="0.62"'));
  });

  it('does nothing while the ruleset has no injury continuation', async () => {
    deck.hold({ ...STOPPED_FOR_INJURY, [rule('Jam.InjuryContinuation')]: 'false' });

    const key = deck.place(keyAction, CONTINUATION);

    await deck.holdDown(keyAction, key, CONTINUATION);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, []);
  });

  it('carries HOLD in its top bar', () => {
    deck.hold(STOPPED_FOR_INJURY);

    const key = deck.place(keyAction, CONTINUATION);

    deck.draw();

    assert.match(drawn(key), />HOLD<\/text>/);
  });
});

describe('Sudden Scoring', () => {
  let deck: FakeDeck;
  let keyAction: JrdaOptions;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new JrdaOptions(deck.context);
  });

  afterEach(() => deck.stop());

  it('reads ENABLED, with the top bar green, while CRG has the period in sudden scoring', () => {
    deck.hold({ [rule('Jam.SuddenScoring')]: 'true', [game('InSuddenScoring')]: true });

    const key = deck.place(keyAction, SUDDEN);

    deck.draw();

    assert.match(drawn(key), />ENABLED</);
    assert.match(drawn(key), /fill="#22c55e"/);
    assert.ok(!drawn(key).includes('opacity="0.62"'));
  });

  it('reads DISABLED while the ruleset allows it but the period has not reached it', () => {
    deck.hold({ [rule('Jam.SuddenScoring')]: 'true', [game('InSuddenScoring')]: false });

    const key = deck.place(keyAction, SUDDEN);

    deck.draw();

    assert.match(drawn(key), />DISABLED</);
    assert.ok(!drawn(key).includes('opacity="0.62"'));
  });

  it('is darkened while the ruleset has no sudden scoring', () => {
    deck.hold({ [rule('Jam.SuddenScoring')]: 'false' });

    const key = deck.place(keyAction, SUDDEN);

    deck.draw();

    assert.ok(drawn(key).includes('opacity="0.62"'));
  });

  it('does nothing when pressed, since CRG decides it', async () => {
    deck.hold({ [rule('Jam.SuddenScoring')]: 'true', [game('InSuddenScoring')]: true });

    await deck.press(keyAction, deck.place(keyAction, SUDDEN), SUDDEN);

    assert.deepEqual(deck.written, []);
  });
});
