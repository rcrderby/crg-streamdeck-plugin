import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { AddTrip, RemoveTrip, Score, TripPointsDown, TripPointsUp } from './scoring.ts';
import { type TeamSettings } from './team-key-action.ts';
import { team } from '../crg/paths.ts';

/** Where a number sits across a key, read back out of the picture it holds. */
function across(key: FakeKey<TeamSettings>, text: string): number {
  const svg = Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
  const found = new RegExp(`<text x="([\\d.]+)"[^>]*>${text}</text>`).exec(svg);

  assert.ok(found, `the key should show ${text}`);

  return Number(found[1]);
}

describe('the Score key', () => {
  let deck: FakeDeck;
  let keyAction: Score;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new Score(deck.context);
    deck.hold({
      [team(1, 'Score')]: 113,
      [team(1, 'JamScore')]: 7,
      [team(2, 'Score')]: 109,
      [team(2, 'JamScore')]: 4
    });
  });

  afterEach(() => deck.stop());

  it('sets team 1 the way the scoreboard does, total first', () => {
    const key = deck.place(keyAction, { team: 1 });

    assert.ok(across(key, '113') < across(key, '7'));
  });

  it('sets team 2 the way the scoreboard does, jam points first', () => {
    const key = deck.place(keyAction, { team: 2 });

    assert.ok(across(key, '4') < across(key, '109'));
  });
});

describe('the trip keys', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('add a point to the trip, or take one away, relative to what it holds', async () => {
    const up = new TripPointsUp(deck.context);
    const down = new TripPointsDown(deck.context);
    const settings: TeamSettings = { team: 2 };

    await deck.press(up, deck.place(up, settings), settings);
    await deck.press(down, deck.place(down), {});

    assert.deepEqual(deck.written, [
      { key: team(2, 'TripScore'), value: 1, flag: 'change' },
      { key: team(1, 'TripScore'), value: -1, flag: 'change' }
    ]);
  });

  it('add a trip, or remove one, with CRG’s own controls', async () => {
    const add = new AddTrip(deck.context);
    const remove = new RemoveTrip(deck.context);

    await deck.press(add, deck.place(add));
    await deck.press(remove, deck.place(remove));

    assert.deepEqual(deck.written, [
      { key: team(1, 'AddTrip'), value: true, flag: '' },
      { key: team(1, 'RemoveTrip'), value: true, flag: '' }
    ]);
  });
});
