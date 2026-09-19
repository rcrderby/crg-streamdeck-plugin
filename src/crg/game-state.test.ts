import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activeClock,
  currentTripNumber,
  immediateScoring,
  jamControlClock,
  lineupWarning,
  replaceChoices,
  replacePending,
  reviewMark,
  reviewWins,
  runningTimeout,
  teamOwning
} from './game-state.ts';
import { StateStore, type StateValue } from './state.ts';

const G = 'ScoreBoard.CurrentGame';
const TEAM_1 = 'game_1';
const TEAM_2 = 'game_2';

function store(values: Record<string, StateValue>): StateStore {
  const state = new StateStore();

  state.apply({ [`${G}.Team(1).Id`]: TEAM_1, [`${G}.Team(2).Id`]: TEAM_2, ...values });

  return state;
}

function timeout(period: number, id: string, fields: Record<string, StateValue>): Record<string, StateValue> {
  return Object.fromEntries(
    Object.entries(fields).map(([field, value]) => [`${G}.Period(${period}).Timeout(${id}).${field}`, value])
  );
}

describe('runningTimeout', () => {
  it('finds none when no recorded timeout is running', () => {
    const state = store({ ...timeout(1, 'a', { Running: false, Owner: TEAM_1 }), [`${G}.TimeoutOwner`]: TEAM_1 });

    assert.deepEqual(runningTimeout(state), { kind: 'none', team: undefined });
  });

  it('reads a running timeout with no owner as untyped', () => {
    const state = store({ ...timeout(1, 'a', { Running: true, Owner: '' }), [`${G}.TimeoutOwner`]: '' });

    assert.equal(runningTimeout(state).kind, 'untyped');
  });

  it('reads the official owner as an official timeout', () => {
    const state = store({ ...timeout(1, 'a', { Running: true }), [`${G}.TimeoutOwner`]: 'O' });

    assert.equal(runningTimeout(state).kind, 'official');
  });

  it('reads a team owner as that team’s timeout, or its review', () => {
    const teamTimeout = store({ ...timeout(1, 'a', { Running: true }), [`${G}.TimeoutOwner`]: TEAM_2 });
    const review = store({
      ...timeout(1, 'a', { Running: true }),
      [`${G}.TimeoutOwner`]: TEAM_1,
      [`${G}.OfficialReview`]: true
    });

    assert.deepEqual(runningTimeout(teamTimeout), { kind: 'team', team: 2 });
    assert.deepEqual(runningTimeout(review), { kind: 'review', team: 1 });
  });

  it('reads a running flag sent as text', () => {
    const state = store({ ...timeout(1, 'a', { Running: 'true' }), [`${G}.TimeoutOwner`]: 'O' });

    assert.equal(runningTimeout(state).kind, 'official');
  });
});

describe('teamOwning', () => {
  it('matches an owner to a team id, and nothing to no owner', () => {
    const state = store({});

    assert.equal(teamOwning(state, TEAM_2), 2);
    assert.equal(teamOwning(state, ''), undefined);
    assert.equal(teamOwning(state, 'O'), undefined);
  });
});

describe('reviewWins', () => {
  it('counts the team’s retained reviews in the current period only', () => {
    const state = store({
      [`${G}.CurrentPeriodNumber`]: 2,
      ...timeout(1, 'old', { Owner: TEAM_1, Review: true, RetainedReview: true }),
      ...timeout(2, 'won', { Owner: TEAM_1, Review: true, RetainedReview: true }),
      ...timeout(2, 'lost', { Owner: TEAM_1, Review: true, RetainedReview: false }),
      ...timeout(2, 'plain', { Owner: TEAM_1, Review: false, RetainedReview: false }),
      ...timeout(2, 'theirs', { Owner: TEAM_2, Review: true, RetainedReview: true })
    });

    assert.equal(reviewWins(state, 1), 1);
    assert.equal(reviewWins(state, 2), 1);
  });

  it('counts none before CRG sends the team’s id', () => {
    assert.equal(reviewWins(new StateStore(), 1), 0);
  });
});

describe('reviewMark', () => {
  it('shows a plus for a review won and still held', () => {
    assert.equal(reviewMark(1, 1), 'retained');
  });

  it('shows a line for a review won twice', () => {
    assert.equal(reviewMark(0, 2), 'twice');
  });

  it('shows no mark for a review not won, or won and then lost', () => {
    assert.equal(reviewMark(1, 0), undefined);
    assert.equal(reviewMark(0, 0), undefined);
    assert.equal(reviewMark(0, 1), undefined);
  });
});

describe('currentTripNumber', () => {
  it('reads the number of the scoring trip whose id matches', () => {
    const state = store({
      [`${G}.Team(1).CurrentTrip`]: 'trip-c',
      [`${G}.Period(1).Jam(2).TeamJam(1).ScoringTrip(1).Id`]: 'trip-a',
      [`${G}.Period(1).Jam(3).TeamJam(1).ScoringTrip(2).Id`]: 'trip-b',
      [`${G}.Period(1).Jam(3).TeamJam(1).ScoringTrip(3).Id`]: 'trip-c'
    });

    assert.equal(currentTripNumber(state, 1), 3);
  });

  it('reads 0 when CRG names no trip or no trip matches', () => {
    assert.equal(currentTripNumber(store({}), 1), 0);
    assert.equal(currentTripNumber(store({ [`${G}.Team(2).CurrentTrip`]: 'missing' }), 2), 0);
  });
});

describe('activeClock', () => {
  it('shows the period clock during a period', () => {
    assert.deepEqual(activeClock(store({ [`${G}.InPeriod`]: true, [`${G}.CurrentPeriodNumber`]: 1 })), {
      clock: 'Period',
      showTime: true
    });
  });

  const labels = {
    'ScoreBoard.Settings.Setting(ScoreBoard.Intermission.PreGame)': 'Time To Derby',
    'ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Intermission)': 'Halftime',
    'ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Unofficial)': 'Unofficial Score',
    'ScoreBoard.Settings.Setting(ScoreBoard.Intermission.Official)': 'Final Score',
    'ScoreBoard.Settings.Setting(ScoreBoard.Intermission.OfficialWithClock)': 'Final Score, Clock',
    [`${G}.Rule(Period.Number)`]: '2',
    [`${G}.InPeriod`]: false
  };

  const intermission = (number: number, extra: Record<string, StateValue> = {}) =>
    activeClock(
      store({
        ...labels,
        [`${G}.Clock(Intermission).Running`]: true,
        [`${G}.Clock(Intermission).Number`]: number,
        ...extra
      })
    );

  it('uses CRG’s own label for the intermission its clock counts', () => {
    assert.deepEqual(intermission(0), { clock: 'Intermission', label: 'Time To Derby', showTime: true });
    assert.deepEqual(intermission(1), { clock: 'Intermission', label: 'Halftime', showTime: true });
  });

  it('hides the time where the scoreboard does: after the last period, and at the final score', () => {
    assert.deepEqual(intermission(2), { clock: 'Intermission', label: 'Unofficial Score', showTime: false });
    assert.deepEqual(intermission(2, { [`${G}.OfficialScore`]: true }), {
      clock: 'Intermission',
      label: 'Final Score',
      showTime: false
    });
  });

  it('shows the time at the final score when CRG is set to show the clock then', () => {
    assert.deepEqual(intermission(2, { [`${G}.OfficialScore`]: true, [`${G}.ClockDuringFinalScore`]: true }), {
      clock: 'Intermission',
      label: 'Final Score, Clock',
      showTime: true
    });
  });

  it('reads Coming Up alone once the countdown to the game has ended', () => {
    const counted = store({
      ...labels,
      [`${G}.CurrentPeriodNumber`]: 1,
      [`${G}.Clock(Intermission).Number`]: 1,
      [`${G}.Clock(Intermission).Running`]: false
    });

    assert.deepEqual(activeClock(counted), { clock: 'Period', label: 'Coming Up', showTime: false });
  });

  it('falls back to CRG’s default labels when the settings are not held', () => {
    assert.deepEqual(
      activeClock(store({ [`${G}.Clock(Intermission).Running`]: true, [`${G}.Clock(Intermission).Number`]: 1 })),
      { clock: 'Intermission', label: 'Intermission', showTime: true }
    );
  });
});

describe('replaceChoices', () => {
  it('offers only the controls CRG allows, in the order of its operator screen', () => {
    const state = store({
      [`${G}.Label(Start)`]: '---',
      [`${G}.Label(Stop)`]: 'Stop Jam',
      [`${G}.Label(Timeout)`]: 'Timeout'
    });

    assert.deepEqual(replaceChoices(state), [
      { text: 'Stop Jam', command: 'StopJam', kind: 'stop' },
      { text: 'Timeout', command: 'Timeout', kind: 'timeout' }
    ]);
  });

  it('tells when CRG is waiting for a replacement', () => {
    assert.equal(replacePending(store({ [`${G}.Label(Replaced)`]: 'Stop Jam' })), true);
    assert.equal(replacePending(store({ [`${G}.Label(Replaced)`]: '---' })), false);
    assert.equal(replacePending(store({})), false);
  });

  it('waits on a replacement for CRG’s own No Action, which CRG offers choices for', () => {
    const state = store({
      [`${G}.Label(Replaced)`]: 'No Action',
      [`${G}.Label(Start)`]: 'Start Jam',
      [`${G}.Label(Stop)`]: 'Lineup',
      [`${G}.Label(Timeout)`]: 'Timeout'
    });

    assert.equal(replacePending(state), true);
    assert.deepEqual(
      replaceChoices(state).map((choice) => choice.text),
      ['Start Jam', 'Lineup', 'Timeout']
    );
  });
});

describe('lineupWarning', () => {
  const lineup = (fields: Record<string, StateValue>): StateStore =>
    store({ [`${G}.Clock(Lineup).Running`]: true, [`${G}.Rule(Lineup.Duration)`]: '0:30', ...fields });

  it('says nothing while the lineup has time in hand', () => {
    assert.equal(lineupWarning(lineup({ [`${G}.Clock(Lineup).Time`]: 24_000 })), 'none');
  });

  it('warns for the last five seconds of the lineup', () => {
    assert.equal(lineupWarning(lineup({ [`${G}.Clock(Lineup).Time`]: 25_000 })), 'due');
    assert.equal(lineupWarning(lineup({ [`${G}.Clock(Lineup).Time`]: 30_000 })), 'due');
  });

  it('says the lineup is over a second after it was due', () => {
    assert.equal(lineupWarning(lineup({ [`${G}.Clock(Lineup).Time`]: 31_000 })), 'over');
  });

  it('takes the length from the rules, not from thirty seconds', () => {
    const longer = lineup({ [`${G}.Rule(Lineup.Duration)`]: '1:00', [`${G}.Clock(Lineup).Time`]: 31_000 });

    assert.equal(lineupWarning(longer), 'none');
  });

  it('takes an overtime lineup’s length from its own rule', () => {
    const overtime = (time: number): StateStore =>
      lineup({
        [`${G}.InOvertime`]: true,
        [`${G}.Rule(Lineup.OvertimeDuration)`]: '1:00',
        [`${G}.Clock(Lineup).Time`]: time
      });

    assert.equal(lineupWarning(overtime(31_000)), 'none');
    assert.equal(lineupWarning(overtime(55_000)), 'due');
    assert.equal(lineupWarning(overtime(61_000)), 'over');
  });

  it('counts a lineup CRG runs backwards by the time it has run', () => {
    const counting = lineup({
      [`${G}.Clock(Lineup).Direction`]: true,
      [`${G}.Clock(Lineup).Time`]: 4_000,
      [`${G}.Clock(Lineup).InvertedTime`]: 26_000
    });

    assert.equal(lineupWarning(counting), 'due');
  });

  it('says nothing with no lineup running, or no rule held', () => {
    assert.equal(lineupWarning(store({ [`${G}.Clock(Lineup).Time`]: 40_000 })), 'none');
    assert.equal(lineupWarning(store({ [`${G}.Clock(Lineup).Running`]: true })), 'none');
  });
});

describe('jamControlClock', () => {
  it('shows the lineup behind Start Jam, never a timeout counting', () => {
    const inTimeout = store({ [`${G}.Clock(Timeout).Running`]: true, [`${G}.Clock(Lineup).Running`]: false });

    assert.equal(jamControlClock(inTimeout, false), undefined);
    assert.equal(jamControlClock(store({ [`${G}.Clock(Lineup).Running`]: true }), false), 'Lineup');
  });

  it('shows the jam behind Stop Jam, and the timeout behind End Timeout', () => {
    const inJam = store({ [`${G}.InJam`]: true, [`${G}.Clock(Jam).Running`]: true });
    const inTimeout = store({ [`${G}.InJam`]: false, [`${G}.Clock(Timeout).Running`]: true });

    assert.equal(jamControlClock(inJam, true), 'Jam');
    assert.equal(jamControlClock(inTimeout, true), 'Timeout');
  });

  it('shows no clock at all when the one it wants is stopped', () => {
    assert.equal(jamControlClock(store({}), false), undefined);
    assert.equal(jamControlClock(store({}), true), undefined);
  });
});

describe('immediateScoring', () => {
  const jams = {
    [`${G}.Period(1).SuddenScoring`]: false,
    [`${G}.Period(1).Jam(9).Id`]: 'last-of-1',
    [`${G}.Period(1).Jam(9).Overtime`]: false,
    [`${G}.Period(2).SuddenScoring`]: true,
    [`${G}.Period(2).Jam(1).Id`]: 'first-of-2',
    [`${G}.Period(2).Jam(1).Overtime`]: false
  };

  it('reads the period of the jam the team’s flags belong to, not the current one', () => {
    const between = store({
      ...jams,
      [`${G}.CurrentPeriodNumber`]: 2,
      [`${G}.Team(1).RunningOrEndedTeamJam`]: 'last-of-1_1'
    });
    const running = store({ ...jams, [`${G}.Team(1).RunningOrEndedTeamJam`]: 'first-of-2_1' });

    assert.equal(immediateScoring(between, 1), false);
    assert.equal(immediateScoring(running, 1), true);
  });

  it('reads false before CRG names the jam, or for a jam it has not sent', () => {
    assert.equal(immediateScoring(store(jams), 1), false);
    assert.equal(immediateScoring(store({ ...jams, [`${G}.Team(2).RunningOrEndedTeamJam`]: 'gone_2' }), 2), false);
  });
});
