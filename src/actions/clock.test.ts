import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { Clock, type ClockSettings } from './clock.ts';
import { clock } from '../crg/paths.ts';

/** The picture a key holds, as SVG text. */
function picture(key: FakeKey<ClockSettings>): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

describe('the Clock key', () => {
  let deck: FakeDeck;
  let keyAction: Clock;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new Clock(deck.context);
    deck.hold({
      [clock('Jam', 'Time')]: 119_400,
      [clock('Jam', 'Direction')]: true,
      [clock('Jam', 'Running')]: true,
      [clock('Lineup', 'Time')]: 12_600,
      [clock('Lineup', 'Direction')]: false
    });
  });

  afterEach(() => deck.stop());

  it('shows a clock counting down the way CRG’s scoreboard does, rounded up', () => {
    assert.match(picture(deck.place(keyAction, { clock: 'Jam' })), />2:00</);
  });

  it('shows a clock counting up the way CRG’s scoreboard does, rounded down', () => {
    assert.match(picture(deck.place(keyAction, { clock: 'Lineup' })), />0:12</);
  });

  it('reads dashes, faded, while the plugin has no CRG', () => {
    const key = deck.place(keyAction, { clock: 'Jam' });

    deck.client.say('disconnected');
    deck.draw();

    assert.match(picture(key), />--:--</);
    assert.ok(picture(key).includes('opacity="0.62"'), 'the key is veiled while CRG is gone');
  });

  it('draws again only for the clock it shows', () => {
    const key = deck.place(keyAction, { clock: 'Lineup' });
    const drawn = key.images.length;

    deck.hold({ [clock('Jam', 'Time')]: 100_000 });
    deck.draw();

    assert.equal(key.images.length, drawn, 'the jam clock ticking says nothing about a lineup key');

    deck.hold({ [clock('Lineup', 'Time')]: 13_600 });
    deck.draw();

    assert.equal(key.images.length, drawn + 1);
  });

  it('names the clock as CRG does, so a lineup after a timeout reads Post Timeout', () => {
    deck.hold({ [clock('Lineup', 'Name')]: 'Post Timeout' });

    assert.match(picture(deck.place(keyAction, { clock: 'Lineup' })), />POST TIMEOUT</);
  });

  it('shows the period number CRG holds, since a period key names which one', () => {
    deck.hold({ [clock('Period', 'Number')]: 2, [clock('Period', 'Time')]: 1_800_000 });

    assert.match(picture(deck.place(keyAction, { clock: 'Period' })), />PERIOD 2</);
  });

  it('shows the jam clock for a setting that names no clock CRG has', () => {
    const key = deck.place(keyAction, { clock: 'Bogus' } as unknown as ClockSettings);

    assert.match(picture(key), />JAM</);
    assert.match(picture(key), />2:00</);
  });
});
