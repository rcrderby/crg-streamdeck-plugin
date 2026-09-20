import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { ActiveClock } from './active-clock.ts';
import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { INTERMISSION_LABELS, clock, game, rule } from '../crg/paths.ts';

/** The picture a key holds, as SVG text. */
function picture(key: FakeKey): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

/** The labels CRG keeps for each intermission, as a scoreboard holds them. */
const LABELS = {
  [INTERMISSION_LABELS.preGame]: 'Time To Derby',
  [INTERMISSION_LABELS.intermission]: 'Halftime',
  [INTERMISSION_LABELS.unofficial]: 'Unofficial Score',
  [INTERMISSION_LABELS.official]: 'Final Score',
  [INTERMISSION_LABELS.officialWithClock]: 'Final Score, Clock',
  [rule('Period.Number')]: '2'
};

describe('the Active Clock key', () => {
  let deck: FakeDeck;
  let keyAction: ActiveClock;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new ActiveClock(deck.context);
    deck.hold(LABELS);
  });

  afterEach(() => deck.stop());

  it('shows the period clock, and which period, during a period', () => {
    deck.hold({
      [game('InPeriod')]: true,
      [clock('Period', 'Number')]: 2,
      [clock('Period', 'Time')]: 1_734_000,
      [clock('Period', 'Direction')]: true,
      [clock('Period', 'Running')]: true
    });

    const key = deck.place(keyAction);

    assert.match(picture(key), />PERIOD 2</);
    assert.match(picture(key), />28:54</);
  });

  it('shows the intermission clock under CRG’s own word for it', () => {
    deck.hold({
      [game('InPeriod')]: false,
      [clock('Intermission', 'Running')]: true,
      [clock('Intermission', 'Number')]: 1,
      [clock('Intermission', 'Time')]: 900_000,
      [clock('Intermission', 'Direction')]: true
    });

    const key = deck.place(keyAction);

    assert.match(picture(key), />HALFTIME</);
    assert.match(picture(key), />15:00</);
  });

  it('shows the word alone where the scoreboard hides the time', () => {
    deck.hold({
      [game('InPeriod')]: false,
      [clock('Intermission', 'Running')]: true,
      [clock('Intermission', 'Number')]: 2,
      [clock('Intermission', 'Time')]: 60_000
    });

    const key = deck.place(keyAction);

    // A title too long for one line is split across two, as the key draws it.
    assert.match(picture(key), />UNOFFICIAL</);
    assert.match(picture(key), />SCORE</);
    assert.doesNotMatch(picture(key), />1:00</);
  });

  it('reads Coming Up once the countdown to the game has ended', () => {
    deck.hold({
      [game('InPeriod')]: false,
      [game('CurrentPeriodNumber')]: 1,
      [clock('Intermission', 'Running')]: false,
      [clock('Intermission', 'Number')]: 1
    });

    const key = deck.place(keyAction);

    assert.match(picture(key), />COMING</);
    assert.match(picture(key), />UP</);
  });

  it('reads dashes, faded, while the plugin has no CRG', () => {
    deck.hold({ [game('InPeriod')]: true, [clock('Period', 'Time')]: 1_734_000 });

    const key = deck.place(keyAction);

    deck.client.say('disconnected');
    deck.draw();

    assert.match(picture(key), />--:--</);
    assert.ok(picture(key).includes('opacity="0.62"'));
  });

  it('draws again as the clock it shows runs', () => {
    deck.hold({ [game('InPeriod')]: true, [clock('Period', 'Time')]: 1_734_000, [clock('Period', 'Running')]: true });

    const key = deck.place(keyAction);
    const drawn = key.images.length;

    deck.hold({ [clock('Period', 'Time')]: 1_733_000 });
    deck.draw();

    assert.equal(key.images.length, drawn + 1);
  });
});
