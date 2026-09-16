import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { JamControl } from './jam-control.ts';
import { clock, game, label, rule } from '../crg/paths.ts';

/** CRG's own way of saying a control cannot be used now. */
const NONE = '---';

/** A timeout CRG has recorded and is running, which is what makes End Timeout mean something. */
const TIMEOUT_RUNNING = { 'ScoreBoard.CurrentGame.Period(2).Timeout(7).Running': true };

/** The words drawn on a key, read back out of the picture it holds. */
function words(key: FakeKey): string[] {
  const svg = Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');

  return [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((match) => match[1] ?? '');
}

describe('the Jam Control key', () => {
  let deck: FakeDeck;
  let keyAction: JamControl;
  let key: FakeKey;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new JamControl(deck.context);
    key = deck.place(keyAction);
  });

  afterEach(() => deck.stop());

  it('starts the jam when that is what CRG offers', async () => {
    deck.hold({ [label('Start')]: 'Start Jam', [label('Stop')]: NONE });
    deck.draw();

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, [{ key: game('StartJam'), value: true, flag: '' }]);
  });

  it('stops the jam when that is what CRG offers', async () => {
    deck.hold({ [label('Start')]: NONE, [label('Stop')]: 'Stop Jam', [game('InJam')]: true });
    deck.draw();

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, [{ key: game('StopJam'), value: true, flag: '' }]);
  });

  it('ends the timeout first while CRG offers both, which is what its own screen does', async () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: 'End Timeout',
      [game('InJam')]: false,
      ...TIMEOUT_RUNNING
    });
    deck.draw();

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, [{ key: game('StopJam'), value: true, flag: '' }]);
  });

  it('starts the jam once an intermission is over, where CRG offers to run a lineup instead', async () => {
    // What CRG holds when halftime has expired: nothing running, and its
    // stop control offering to start the lineup clock.
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: 'Lineup',
      [game('InJam')]: false,
      [clock('Lineup', 'Running')]: false,
      [clock('Intermission', 'Running')]: false,
      [clock('Intermission', 'Time')]: 0
    });
    deck.draw();

    assert.deepEqual(words(key), ['Start', 'Jam'], 'the key should read Start Jam, not Lineup');

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, [{ key: game('StartJam'), value: true, flag: '' }]);
  });

  it('shows no clock when nothing is running, so the wording fills the key', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: 'Lineup',
      [clock('Lineup', 'Running')]: false,
      [clock('Lineup', 'Time')]: 21_200
    });
    deck.draw();

    assert.doesNotMatch(key.image ?? '', /0:21/);
  });

  it('starts the jam before the game, where CRG offers the same lineup', async () => {
    deck.hold({ [label('Start')]: 'Start Jam', [label('Stop')]: 'Lineup' });
    deck.draw();

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, [{ key: game('StartJam'), value: true, flag: '' }]);
  });

  it('does nothing when CRG offers neither', async () => {
    deck.hold({ [label('Start')]: NONE, [label('Stop')]: NONE });
    deck.draw();

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, []);
  });

  it('writes nothing while CRG is away', async () => {
    deck.hold({ [label('Start')]: 'Start Jam', [label('Stop')]: NONE });
    deck.client.say('disconnected');
    deck.draw();

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, []);
  });

  it('keeps working while a write was refused, as the keys beside it do', async () => {
    deck.hold({ [label('Start')]: 'Start Jam', [label('Stop')]: NONE });
    deck.client.say('unauthorized');
    deck.draw();

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, [{ key: game('StartJam'), value: true, flag: '' }]);
  });

  it('shows the jam clock in a jam, and the lineup clock between jams', () => {
    deck.hold({
      [label('Start')]: NONE,
      [label('Stop')]: 'Stop Jam',
      [game('InJam')]: true,
      [clock('Jam', 'Running')]: true,
      [clock('Jam', 'Time')]: 92_000,
      [clock('Jam', 'Name')]: 'Jam'
    });
    deck.draw();

    const inJam = key.image;

    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: NONE,
      [game('InJam')]: false,
      [clock('Jam', 'Running')]: false,
      [clock('Lineup', 'Running')]: true,
      [clock('Lineup', 'Time')]: 12_000,
      [clock('Lineup', 'Name')]: 'Lineup'
    });
    deck.draw();

    assert.notEqual(key.image, inJam);
  });

  it('warns as the lineup runs out of the time the rules give it, and pulses once it is over', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: NONE,
      [rule('Lineup.Duration')]: '0:30',
      [clock('Lineup', 'Running')]: true,
      [clock('Lineup', 'Direction')]: false,
      [clock('Lineup', 'Time')]: 10_000
    });
    deck.draw();

    const settled = key.image;

    deck.hold({ [clock('Lineup', 'Time')]: 26_000 });
    deck.draw();

    assert.notEqual(key.image, settled, 'five seconds from due should look different');

    deck.hold({ [clock('Lineup', 'Time')]: 32_000 });
    deck.draw();

    // A key that pulses asks to be drawn again as soon as it is drawn.
    assert.equal(deck.scheduler.pending, 1, 'a lineup over its time should pulse');
  });

  it('stands still while the lineup is within its time', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [rule('Lineup.Duration')]: '0:30',
      [clock('Lineup', 'Running')]: true,
      [clock('Lineup', 'Time')]: 10_000
    });
    deck.draw();

    assert.equal(deck.scheduler.pending, 0);
  });
});
