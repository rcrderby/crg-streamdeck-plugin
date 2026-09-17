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

  it('shows the jam clock for a setting that names no clock CRG has', () => {
    const key = deck.place(keyAction, { clock: 'Bogus' } as unknown as ClockSettings);

    assert.match(picture(key), />JAM</);
    assert.match(picture(key), />2:00</);
  });
});
