import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck } from '../test-support/fake-deck.ts';
import { TripPoints, type TripPointsSettings } from './trip-points.ts';
import { team } from '../crg/paths.ts';

describe('the Trip Points key', () => {
  let deck: FakeDeck;
  let keyAction: TripPoints;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new TripPoints(deck.context);
  });

  afterEach(() => deck.stop());

  /** Presses a key set to these settings, and returns what it wrote. */
  async function press(settings: TripPointsSettings): Promise<unknown> {
    await deck.press(keyAction, deck.place(keyAction, settings), settings);

    return deck.written.at(-1);
  }

  it('puts its points on the trip of the team it is set to', async () => {
    assert.deepEqual(await press({ team: '2', points: '3' }), { key: team(2, 'TripScore'), value: 3, flag: '' });
  });

  it('sets the points outright rather than adding them', async () => {
    deck.hold({ [team(1, 'TripScore')]: 2 });

    assert.deepEqual(await press({ points: 4 }), { key: team(1, 'TripScore'), value: 4, flag: '' });
  });

  it('keeps a setting inside the nought to four points CRG accepts', async () => {
    assert.equal(((await press({ points: 9 })) as { value: number }).value, 4);
    assert.equal(((await press({ points: -2 })) as { value: number }).value, 0);
    assert.equal(((await press({ points: 'two' })) as { value: number }).value, 0);
  });
});
