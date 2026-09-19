/**
 * What the game is doing, where it takes more than one path to tell.
 *
 * Which kind of timeout is running, how many reviews a team has won this
 * period, which trip a jammer is on, and which clock to watch each need
 * several values read together. They live here, outside the actions, so
 * they can be tested without a scoreboard.
 */

import {
  CURRENT_GAME,
  INTERMISSION_LABELS,
  JAMS,
  OFFICIAL_OWNER,
  SCORING_TRIP_IDS,
  TIMEOUTS,
  type ClockName,
  type TeamNumber,
  clock,
  game,
  isUnavailable,
  label,
  rule,
  team
} from './paths.ts';
import { parseClock } from '../render/time.ts';
import { type StateStore } from './state.ts';

export type TimeoutKind = 'none' | 'untyped' | 'official' | 'team' | 'review';

export type RunningTimeout = {
  readonly kind: TimeoutKind;
  /** The team a team timeout or official review belongs to. */
  readonly team: TeamNumber | undefined;
};

/** The mark a team's won reviews earn on its Official Review key. */
export type ReviewMark = 'retained' | 'twice';

/**
 * Which clock the Active Clock key shows, the label it goes by when not
 * the period clock's own name, and whether CRG's scoreboard shows its time.
 */
export type ActiveClock = {
  readonly clock: 'Period' | 'Intermission';
  readonly label?: string;
  readonly showTime: boolean;
};

/** What CRG's scoreboard shows when no clock is running outside a period. */
export const COMING_UP = 'Coming Up';

/** What a replacement for an undone action does, which decides its key's color. */
export type ReplaceChoiceKind = 'start' | 'stop' | 'timeout';

/** One control CRG allows in place of an undone action, in CRG's own words. */
export type ReplaceChoice = {
  readonly text: string;
  readonly command: 'StartJam' | 'StopJam' | 'Timeout';
  readonly kind: ReplaceChoiceKind;
};

/** True while CRG has undone an action and is waiting for its replacement. */
export function replacePending(state: StateStore): boolean {
  return !isUnavailable(state.getString(label('Replaced')));
}

/** The controls CRG allows now, in the order its operator screen shows them. */
export function replaceChoices(state: StateStore): ReplaceChoice[] {
  const controls = [
    { name: 'Start', command: 'StartJam', kind: 'start' },
    { name: 'Stop', command: 'StopJam', kind: 'stop' },
    { name: 'Timeout', command: 'Timeout', kind: 'timeout' }
  ] as const;

  return controls
    .map(({ name, command, kind }) => ({ text: state.getString(label(name)), command, kind }))
    .filter((choice) => !isUnavailable(choice.text));
}

/**
 * The clock the Jam Control key's own action runs against.
 *
 * The clock follows what the key offers rather than whatever happens to
 * be running, so a key reading Start Jam always shows the lineup and
 * never a timeout counting beneath it. A clock that is not running is
 * not shown at all, and the wording fills the key instead.
 */
export function jamControlClock(state: StateStore, stopping: boolean): ClockName | undefined {
  const name: ClockName = stopping ? (state.getBoolean(game('InJam')) ? 'Jam' : 'Timeout') : 'Lineup';

  return state.getBoolean(clock(name, 'Running')) ? name : undefined;
}

/** How the lineup stands against the time the rules give it. */
export type LineupWarning = 'none' | 'due' | 'over';

/** How long before the lineup is due that the key starts warning. */
const LINEUP_DUE_MS = 5_000;

/** How long past due that the key starts pulsing. */
const LINEUP_OVER_MS = 1_000;

/** The rule that sets the lineup's length, which is its own rule in overtime. */
function lineupRule(state: StateStore): 'Lineup.Duration' | 'Lineup.OvertimeDuration' {
  return state.getBoolean(game('InOvertime')) ? 'Lineup.OvertimeDuration' : 'Lineup.Duration';
}

/** How long a clock has run, whichever way CRG counts it. */
function elapsedOn(state: StateStore, name: ClockName): number {
  return state.getBoolean(clock(name, 'Direction'))
    ? state.getNumber(clock(name, 'InvertedTime'))
    : state.getNumber(clock(name, 'Time'));
}

/**
 * Whether the lineup is nearly up, or already over.
 *
 * The rules give the lineup its length, and a longer one before an
 * overtime jam, so a league running something other than thirty seconds
 * gets its warning in the right place. With no rule held, or no lineup
 * running, there is nothing to warn about.
 */
export function lineupWarning(state: StateStore): LineupWarning {
  if (!state.getBoolean(clock('Lineup', 'Running'))) {
    return 'none';
  }

  const duration = parseClock(state.getString(rule(lineupRule(state))));

  if (duration <= 0) {
    return 'none';
  }

  const elapsed = elapsedOn(state, 'Lineup');

  if (elapsed >= duration + LINEUP_OVER_MS) {
    return 'over';
  }

  return elapsed >= duration - LINEUP_DUE_MS ? 'due' : 'none';
}

/**
 * Which lineup is running, as CRG colors it.
 *
 * CRG turns a running lineup red while it publishes NoMoreJam: the period
 * has too little time left for another jam, or the lineup is before an
 * overtime jam, where the period clock has already run out.
 */
export type LineupKind = 'regular' | 'noMoreJams' | 'overtime';

export function lineupKind(state: StateStore): LineupKind {
  if (!state.getBoolean(clock('Lineup', 'Running')) || !state.getBoolean(game('NoMoreJam'))) {
    return 'regular';
  }

  return state.getBoolean(game('InOvertime')) ? 'overtime' : 'noMoreJams';
}

/** A flag CRG may send as a boolean or as text. */
function isTrue(value: unknown): boolean {
  return value === true || value === 'true';
}

/** The team whose id CRG uses as a timeout's owner. */
export function teamOwning(state: StateStore, owner: string): TeamNumber | undefined {
  if (owner === '') {
    return undefined;
  }

  return ([1, 2] as const).find((number) => state.getString(team(number, 'Id')) === owner);
}

/**
 * The timeout running now, and whose it is.
 *
 * CRG keeps the timeout clock and the timeout's owner after a timeout
 * ends, so neither says whether one is running. Each recorded timeout
 * carries its own running flag, which does.
 */
export function runningTimeout(state: StateStore): RunningTimeout {
  const running = state.matching(TIMEOUTS.running).some(([, value]) => isTrue(value));

  if (!running) {
    return { kind: 'none', team: undefined };
  }

  const owner = state.getString(game('TimeoutOwner'));

  if (owner === OFFICIAL_OWNER) {
    return { kind: 'official', team: undefined };
  }

  const owningTeam = teamOwning(state, owner);

  if (owningTeam === undefined) {
    return { kind: 'untyped', team: undefined };
  }

  return { kind: state.getBoolean(game('OfficialReview')) ? 'review' : 'team', team: owningTeam };
}

/**
 * How many official reviews a team has won in the current period.
 *
 * CRG records every timeout under its period. A won review is one the
 * team owns that is marked as a review and as retained.
 */
export function reviewWins(state: StateStore, number: TeamNumber): number {
  const id = state.getString(team(number, 'Id'));

  if (id === '') {
    return 0;
  }

  const period = state.getNumber(game('CurrentPeriodNumber'), 0);
  const prefix = `${CURRENT_GAME}.Period(${period}).Timeout(`;

  return state.matching(TIMEOUTS.owner).filter(([path, owner]) => {
    if (!path.startsWith(prefix) || owner !== id) {
      return false;
    }

    const timeout = path.slice(0, -'Owner'.length);

    return isTrue(state.get(`${timeout}Review`)) && isTrue(state.get(`${timeout}RetainedReview`));
  }).length;
}

/**
 * The mark a team's Official Review key shows.
 *
 * A review won and retained shows a plus. One won twice shows a line,
 * since a second win earns no second review. A review won and then
 * lost shows no mark, the same as one used and lost.
 */
export function reviewMark(left: number, wins: number): ReviewMark | undefined {
  if (wins >= 2) {
    return 'twice';
  }

  return wins === 1 && left > 0 ? 'retained' : undefined;
}

/**
 * The number of the trip a team's jammer is on, or 0 when CRG has none.
 *
 * CRG gives a team's current trip by id; the trip's number is the key
 * the matching scoring trip sits under.
 */
export function currentTripNumber(state: StateStore, number: TeamNumber): number {
  const id = state.getString(team(number, 'CurrentTrip'));

  if (id === '') {
    return 0;
  }

  const match = state.matching(SCORING_TRIP_IDS).find(([, value]) => value === id);
  const trip = /ScoringTrip\((\d+)\)\.Id$/.exec(match?.[0] ?? '');

  return trip === null ? 0 : Number(trip[1]);
}

/**
 * Whether CRG refuses Lead and Lost Lead for the team right now.
 *
 * CRG keeps no lead in an overtime jam or in a period of JRDA sudden
 * scoring, and decides it by the jam the team's flags belong to: the one
 * running, or the last one between jams. An overtime lineup still edits
 * the regular jam before it, so the flags work until the overtime jam
 * starts.
 */
export function immediateScoring(state: StateStore, number: TeamNumber): boolean {
  const teamJam = state.getString(team(number, 'RunningOrEndedTeamJam'));
  const jamId = teamJam.replace(/_\d+$/, '');

  if (jamId === '') {
    return false;
  }

  const match = state.matching(JAMS.id).find(([, value]) => value === jamId);

  if (match === undefined) {
    return false;
  }

  const jam = match[0].replace(/\.Id$/, '');
  const period = jam.replace(/\.Jam\(\d+\)$/, '');

  return state.getBoolean(`${jam}.Overtime`) || state.getBoolean(`${period}.SuddenScoring`);
}

/**
 * Which clock is the one to watch, and what CRG calls the moment.
 *
 * This follows CRG's own scoreboard. During a period it is the period
 * clock. While the intermission clock runs, it is that clock, called by
 * the label for the intermission it counts: before the game, between
 * periods, or after the last period. After the last period, and at the
 * final score unless CRG is set to show the clock then, the scoreboard
 * shows the label without the time. With no clock running, as when the
 * countdown to the game has ended, it shows Coming Up alone.
 */
export function activeClock(state: StateStore): ActiveClock {
  if (state.getBoolean(game('InPeriod'))) {
    return { clock: 'Period', showTime: true };
  }

  if (!state.getBoolean(clock('Intermission', 'Running'))) {
    return { clock: 'Period', label: COMING_UP, showTime: false };
  }

  const number = state.getNumber(clock('Intermission', 'Number'), 0);
  const last = number === state.getNumber(rule('Period.Number'), 2);

  const label = (path: string, fallback: string, showTime: boolean): ActiveClock => ({
    clock: 'Intermission',
    label: state.getString(path, fallback),
    showTime
  });

  if (state.getBoolean(game('OfficialScore'))) {
    return state.getBoolean(game('ClockDuringFinalScore'))
      ? label(INTERMISSION_LABELS.officialWithClock, 'Final Score', true)
      : label(INTERMISSION_LABELS.official, 'Final Score', false);
  }

  if (number === 0) {
    return label(INTERMISSION_LABELS.preGame, 'Time To Derby', true);
  }

  return last
    ? label(INTERMISSION_LABELS.unofficial, 'Unofficial Score', false)
    : label(INTERMISSION_LABELS.intermission, 'Intermission', true);
}

/** Where JRDA sudden scoring stands: not in the ruleset, allowed but not reached, or active this period. */
export function suddenScoring(state: StateStore): 'off' | 'allowed' | 'active' {
  if (state.getBoolean(game('InSuddenScoring'))) {
    return 'active';
  }

  return state.getBoolean(rule('Jam.SuddenScoring')) ? 'allowed' : 'off';
}

/**
 * Whether or not an injury continuation is available.
 *
 * This is CRG's own test for showing its Continuation Upcoming button:
 * the rule is on and INJ is set. INJ is set for both teams at once, so
 * CRG checks only Team 1.
 */
export function continuationAvailable(state: StateStore): boolean {
  return state.getBoolean(rule('Jam.InjuryContinuation')) && state.getBoolean(team(1, 'Injury'));
}

/**
 * How long a continued jam would run, or undefined before a jam has stopped.
 *
 * CRG starts a continuation at the jam clock's maximum less the duration
 * of the jam that stopped. The maximum is used rather than the rule..
 */
export function continuationTime(state: StateStore): number | undefined {
  const period = state.getNumber(game('CurrentPeriodNumber'), 0);
  const jam = state.getNumber(clock('Jam', 'Number'), 0);
  const maximum = state.get(clock('Jam', 'MaximumTime'));
  const duration = state.get(`${CURRENT_GAME}.Period(${period}).Jam(${jam}).Duration`);

  if (period === 0 || jam === 0 || typeof maximum !== 'number' || typeof duration !== 'number') {
    return undefined;
  }

  return Math.max(0, maximum - duration);
}
