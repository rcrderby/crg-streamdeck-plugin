import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { FinalScoreWait } from './final-score-wait.ts';
import { game, rule, team } from './paths.ts';
import { StateStore, type StateValue } from './state.ts';

/** A game in its last jam, with a thirty second lineup and team 1 holding a review. */
const IN_LAST_JAM: Record<string, StateValue> = {
  [game('InJam')]: true,
  [rule('Lineup.Duration')]: '0:30',
  [team(1, 'Score')]: 100,
  [team(2, 'Score')]: 98,
  [team(1, 'OfficialReviews')]: 1,
  [team(2, 'OfficialReviews')]: 0
};

describe('FinalScoreWait', () => {
  let state: StateStore;
  let wait: FinalScoreWait;

  beforeEach(() => {
    mock.timers.enable({ apis: ['Date'] });
    state = new StateStore();
    state.apply(IN_LAST_JAM);
    wait = new FinalScoreWait(state);
  });

  afterEach(() => mock.timers.reset());

  it('knows nothing of a wait it did not see begin', () => {
    assert.equal(wait.remaining(), undefined);
  });

  it('waits a lineup’s length once the jam ends, while a team has a review', () => {
    state.apply({ [game('InJam')]: false });
    mock.timers.tick(12_000);

    assert.equal(wait.remaining(), 18_000);
  });

  it('waits ten seconds after a score changes, never shortening a longer wait', () => {
    state.apply({ [game('InJam')]: false });
    mock.timers.tick(25_000);
    state.apply({ [team(2, 'Score')]: 99 });

    assert.equal(wait.remaining(), 10_000);

    state.apply({ [team(2, 'Score')]: 100 });

    assert.equal(wait.remaining(), 10_000);
  });

  it('does not wait when neither team has a review left', () => {
    state.apply({ [team(1, 'OfficialReviews')]: 0 });
    state.apply({ [game('InJam')]: false });

    assert.equal(wait.remaining(), undefined);
  });

  it('runs out at zero', () => {
    state.apply({ [game('InJam')]: false });
    mock.timers.tick(40_000);

    assert.equal(wait.remaining(), 0);
  });

  it('starts no wait from the first reading after the plugin is pointed at another scoreboard', () => {
    state.clear();
    state.apply({ ...IN_LAST_JAM, [game('InJam')]: false });

    assert.equal(wait.remaining(), undefined);
  });

  it('forgets what it saw, as when the plugin loses CRG', () => {
    state.apply({ [game('InJam')]: false });
    wait.forget();

    assert.equal(wait.remaining(), undefined);
  });
});
