import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { ReviewOptions, type ReviewOptionSettings } from './review-options.ts';
import { game, rule, team } from '../crg/paths.ts';

/** The SVG a key was last drawn with, out of the data URI Stream Deck is sent. */
function drawn(key: FakeKey<ReviewOptionSettings>): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

const PERIOD = 'ScoreBoard.CurrentGame.Period(2)';

/** Team 2 in its review, as Tim staged it in CRG: its first review of the period already retained. */
const REVIEWING = {
  [team(2, 'Id')]: 'game_2',
  [game('CurrentPeriodNumber')]: 2,
  [rule('Team.MaxRetains')]: '1',
  [team(2, 'InOfficialReview')]: true,
  [team(2, 'RetainedOfficialReview')]: false,
  [`${PERIOD}.Timeout(first).Owner`]: 'game_2',
  [`${PERIOD}.Timeout(first).Review`]: true,
  [`${PERIOD}.Timeout(first).RetainedReview`]: true,
  [`${PERIOD}.Timeout(now).Owner`]: 'game_2',
  [`${PERIOD}.Timeout(now).Review`]: true,
  [`${PERIOD}.Timeout(now).RetainedReview`]: false
};

const RETAINED: ReviewOptionSettings = { team: 2, option: 'retained' };

const AS_TIMEOUT: ReviewOptionSettings = { team: 2, option: 'timeout' };

describe('the Official Review Options key', () => {
  let deck: FakeDeck;
  let keyAction: ReviewOptions;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new ReviewOptions(deck.context);
  });

  afterEach(() => deck.stop());

  it('marks the team’s running review as retained', async () => {
    deck.hold({ ...REVIEWING });

    await deck.press(keyAction, deck.place(keyAction, RETAINED), RETAINED);

    assert.deepEqual(deck.written, [{ key: team(2, 'RetainedOfficialReview'), value: true, flag: '' }]);
  });

  it('clears the mark when the review is already retained', async () => {
    deck.hold({ ...REVIEWING, [team(2, 'RetainedOfficialReview')]: true });

    await deck.press(keyAction, deck.place(keyAction, RETAINED), RETAINED);

    assert.deepEqual(deck.written, [{ key: team(2, 'RetainedOfficialReview'), value: false, flag: '' }]);
  });

  it('marks the review as taken as a team timeout, on CRG’s one game flag', async () => {
    deck.hold({ ...REVIEWING });

    await deck.press(keyAction, deck.place(keyAction, AS_TIMEOUT), AS_TIMEOUT);

    assert.deepEqual(deck.written, [{ key: game('ReviewIsTo'), value: true, flag: '' }]);
  });

  it('does nothing, and is darkened, while the team has no review running', async () => {
    deck.hold({ ...REVIEWING, [team(2, 'InOfficialReview')]: false });

    const key = deck.place(keyAction, AS_TIMEOUT);

    await deck.press(keyAction, key, AS_TIMEOUT);

    assert.deepEqual(deck.written, []);
    assert.ok(drawn(key).includes('opacity="0.62"'));
  });

  it('does nothing for the other team’s review', async () => {
    deck.hold({ ...REVIEWING });

    const settings: ReviewOptionSettings = { team: 1, option: 'retained' };

    await deck.press(keyAction, deck.place(keyAction, settings), settings);

    assert.deepEqual(deck.written, []);
  });

  it('reads Review Won once the team has used its retains this period', () => {
    deck.hold({ ...REVIEWING });

    const key = deck.place(keyAction, RETAINED);

    deck.draw();

    assert.match(drawn(key), />Won</);
  });

  it('reads Review Retained while a retain is left, and counts the running review only once', () => {
    deck.hold({
      ...REVIEWING,
      [`${PERIOD}.Timeout(first).RetainedReview`]: false,
      [team(2, 'RetainedOfficialReview')]: true,
      [`${PERIOD}.Timeout(now).RetainedReview`]: true
    });

    const key = deck.place(keyAction, RETAINED);

    deck.draw();

    assert.match(drawn(key), />Retained</);
  });

  it('shows the top bar while its option is set', () => {
    deck.hold({ ...REVIEWING, [game('ReviewIsTo')]: true });

    const key = deck.place(keyAction, AS_TIMEOUT);

    deck.draw();

    assert.match(drawn(key), /fill="#22c55e"/);
  });
});
