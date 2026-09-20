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
/** The SVG a key was last drawn with, out of the data URI Stream Deck is sent. */
function drawn(key: FakeKey): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

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

    assert.deepEqual(words(key), ['START', 'JAM'], 'the key should read Start Jam, not Lineup');

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, [{ key: game('StartJam'), value: true, flag: '' }]);
  });

  it('names the jam CRG holds in the foot, in every state but a jam of its own', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: 'Lineup',
      [clock('Jam', 'Number')]: 13,
      [clock('Lineup', 'Running')]: false
    });
    deck.draw();

    assert.deepEqual(words(key), ['START', 'JAM', 'JAM 13'], 'with nothing running');

    deck.hold({ [clock('Lineup', 'Running')]: true, [clock('Lineup', 'Time')]: 21_000 });
    deck.draw();

    assert.deepEqual(words(key), ['START JAM', '0:21', 'LINEUP', 'JAM 13'], 'during a lineup');

    deck.hold({
      [label('Stop')]: 'End Timeout',
      'ScoreBoard.CurrentGame.Period(2).Timeout(7).Running': true,
      [clock('Lineup', 'Running')]: false,
      [clock('Timeout', 'Running')]: true,
      [clock('Timeout', 'Time')]: 43_000
    });
    deck.draw();

    assert.deepEqual(words(key), ['END TIMEOUT', '0:43', 'JAM 13'], 'during a timeout');
  });

  it('keeps the clock name and the jam number readable after a timeout, where CRG renames the lineup', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: 'Lineup',
      [clock('Jam', 'Number')]: 13,
      [clock('Lineup', 'Running')]: true,
      [clock('Lineup', 'Time')]: 21_000,
      [clock('Lineup', 'Name')]: 'Post Timeout'
    });
    deck.draw();

    assert.deepEqual(words(key), ['START JAM', '0:21', 'POST TIMEOUT', 'JAM 13']);
    assert.doesNotMatch(key.image ?? '', /font-size="[0-9.]*[0-8]\.[0-9]*" font-weight="bold"/);
  });

  it('says nothing of the jam before the first one of a period, rather than naming jam zero', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: 'Lineup',
      [clock('Jam', 'Number')]: 0,
      [clock('Lineup', 'Running')]: false
    });
    deck.draw();

    assert.deepEqual(words(key), ['START', 'JAM']);

    deck.hold({ [clock('Lineup', 'Running')]: true, [clock('Lineup', 'Time')]: 21_000 });
    deck.draw();

    assert.deepEqual(words(key), ['START JAM', '0:21', 'LINEUP']);
  });

  it('lets a jam clock name its own jam, as it already did', () => {
    deck.hold({
      [label('Stop')]: 'Stop Jam',
      [game('InJam')]: true,
      [clock('Jam', 'Number')]: 13,
      [clock('Jam', 'Running')]: true,
      [clock('Jam', 'Time')]: 64_000
    });
    deck.draw();

    assert.deepEqual(words(key), ['STOP JAM', '1:04', 'JAM 13']);
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

  it('turns red, and stays red without a pulse, when CRG says no jam is left in the period', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: NONE,
      [rule('Lineup.Duration')]: '0:30',
      [game('NoMoreJam')]: true,
      [clock('Lineup', 'Running')]: true,
      [clock('Lineup', 'Direction')]: false,
      [clock('Lineup', 'Time')]: 10_000
    });
    deck.draw();

    assert.match(drawn(key), /fill="#dd3333"/);

    deck.hold({ [clock('Lineup', 'Time')]: 32_000 });
    deck.draw();

    assert.match(drawn(key), /fill="#dd3333"/);
    assert.equal(deck.scheduler.pending, 0, 'no jam is due, so nothing pulses');
  });

  it('runs an overtime lineup red, then amber, then pulses', () => {
    deck.hold({
      [label('Start')]: 'Start Jam',
      [label('Stop')]: NONE,
      [rule('Lineup.OvertimeDuration')]: '1:00',
      [game('InOvertime')]: true,
      [game('NoMoreJam')]: true,
      [clock('Lineup', 'Running')]: true,
      [clock('Lineup', 'Direction')]: false,
      [clock('Lineup', 'Time')]: 20_000
    });
    deck.draw();

    assert.match(drawn(key), /fill="#dd3333"/);

    deck.hold({ [clock('Lineup', 'Time')]: 56_000 });
    deck.draw();

    assert.match(drawn(key), /fill="#f59e0b"/);

    deck.hold({ [clock('Lineup', 'Time')]: 62_000 });
    deck.draw();

    assert.equal(deck.scheduler.pending, 1, 'an overtime lineup over its time should pulse');
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

  it('reads Start Jam, faded, and does nothing once the official score is set', async () => {
    deck.hold({ [label('Start')]: 'Start Jam', [label('Stop')]: 'Lineup', [game('OfficialScore')]: true });
    deck.draw();

    const faded = key.image;

    await deck.press(keyAction, key);

    assert.deepEqual(words(key), ['START', 'JAM']);
    assert.deepEqual(deck.written, []);

    deck.hold({ [game('OfficialScore')]: false });
    deck.draw();

    assert.notEqual(key.image, faded, 'the key should brighten once CRG will act again');
  });

  it('reads Start Jam, faded, and does nothing before CRG has sent its labels', async () => {
    await deck.press(keyAction, key);

    assert.deepEqual(words(key), ['START', 'JAM']);
    assert.match(Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8'), /opacity="0.45"/);
    assert.deepEqual(deck.written, []);
  });
});
