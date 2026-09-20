import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck } from '../test-support/fake-deck.ts';
import { TeamKeyAction, type TeamSettings, teamOf, teamPaths, themeOf } from './team-key-action.ts';
import { type KeySpec } from '../render/key.ts';
import { clock, team } from '../crg/paths.ts';

/** A team key that counts how often it is asked to draw itself. */
class CountingTeamKey extends TeamKeyAction {
  drawn = 0;

  protected override watchedPaths(): readonly string[] {
    return [...teamPaths('Score'), clock('Jam', 'Time')];
  }

  protected override describe(settings: TeamSettings): KeySpec {
    this.drawn += 1;

    return {
      background: '#000000',
      texts: [{ text: themeOf(this.context.client.state, settings).name, y: 50, size: 12 }]
    };
  }
}

describe('teamOf', () => {
  it('reads the team a key is set to, and the first team by default', () => {
    assert.equal(teamOf({ team: 2 }), 2);
    assert.equal(teamOf({ team: '2' }), 2);
    assert.equal(teamOf({}), 1);
  });
});

describe('a key drawn in one team’s colors', () => {
  let deck: FakeDeck;
  let keyAction: CountingTeamKey;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new CountingTeamKey(deck.context);
  });

  afterEach(() => deck.stop());

  it('draws again for its own team, and not for the other', () => {
    deck.place(keyAction, { team: 1 });

    const drawn = keyAction.drawn;

    deck.hold({ [team(2, 'Score')]: 200 });
    deck.draw();

    assert.equal(keyAction.drawn, drawn, 'the other team scoring says nothing about this key');

    deck.hold({ [team(1, 'Score')]: 114 });
    deck.draw();

    assert.equal(keyAction.drawn, drawn + 1);
  });

  it('draws again for a change that belongs to no team, such as a clock', () => {
    deck.place(keyAction, { team: 1 });

    const drawn = keyAction.drawn;

    deck.hold({ [clock('Jam', 'Time')]: 42_000 });
    deck.draw();

    assert.equal(keyAction.drawn, drawn + 1);
  });

  it('follows the team a key is set to, not the team beside it', () => {
    deck.place(keyAction, { team: 2 });

    const drawn = keyAction.drawn;

    deck.hold({ [team(1, 'Score')]: 114 });
    deck.draw();

    assert.equal(keyAction.drawn, drawn);

    deck.hold({ [team(2, 'Name')]: 'Wheels of Justice' });
    deck.draw();

    assert.equal(keyAction.drawn, drawn + 1);
  });
});
