import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { BAR_ACTIVE, BAR_INACTIVE } from '../render/key.ts';
import { OfficialReview, TeamTimeout } from './team-resources.ts';
import { type TeamSettings } from './team-key-action.ts';
import { team } from '../crg/paths.ts';

/** The picture a key holds, as SVG text. */
function picture(key: FakeKey<TeamSettings>): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

/** The color of a key's top bar. */
function barColor(key: FakeKey<TeamSettings>): string | undefined {
  return /<rect width="100" height="12" fill="(#[0-9a-f]{6})"\/>/.exec(picture(key))?.[1];
}

describe('the Team Timeout key', () => {
  let deck: FakeDeck;
  let keyAction: TeamTimeout;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new TeamTimeout(deck.context);
  });

  afterEach(() => deck.stop());

  it('calls a timeout for the team it is set to', async () => {
    const settings: TeamSettings = { team: 2 };

    await deck.press(keyAction, deck.place(keyAction, settings), settings);

    assert.deepEqual(deck.written, [{ key: team(2, 'Timeout'), value: true, flag: '' }]);
  });

  it('shows its bar active only while the team’s timeout runs', () => {
    const key = deck.place(keyAction);

    assert.equal(barColor(key), BAR_INACTIVE);

    deck.hold({ [team(1, 'InTimeout')]: true });
    deck.draw();

    assert.equal(barColor(key), BAR_ACTIVE);
  });
});

describe('the Official Review key', () => {
  let deck: FakeDeck;
  let keyAction: OfficialReview;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new OfficialReview(deck.context);
  });

  afterEach(() => deck.stop());

  it('calls a review for the team it is set to', async () => {
    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: team(1, 'OfficialReview'), value: true, flag: '' }]);
  });

  it('shows its bar active only while the team’s review runs', () => {
    const key = deck.place(keyAction, { team: 2 });

    assert.equal(barColor(key), BAR_INACTIVE);

    deck.hold({ [team(2, 'InOfficialReview')]: true });
    deck.draw();

    assert.equal(barColor(key), BAR_ACTIVE);
  });

  it('draws a different mark once the team has won its review this period', () => {
    const key = deck.place(keyAction);
    const before = picture(key);
    const timeout = 'ScoreBoard.CurrentGame.Period(1).Timeout(t1)';

    deck.hold({
      [team(1, 'Id')]: 'team-one',
      'ScoreBoard.CurrentGame.CurrentPeriodNumber': 1,
      [`${timeout}.Owner`]: 'team-one',
      [`${timeout}.Review`]: true,
      [`${timeout}.RetainedReview`]: true
    });
    deck.draw();

    assert.notEqual(picture(key), before);
  });
});
