/**
 * Paths into the CRG scoreboard state.
 *
 * CRG addresses everything by a dotted path, and 'ScoreBoard.CurrentGame'
 * mirrors whichever game is loaded for both reads and writes, so no part
 * of the plugin tracks a game identifier.
 */

export const CURRENT_GAME = 'ScoreBoard.CurrentGame';

/**
 * Everything CRG keeps under Settings.
 *
 * The whole subtree is registered, rather than each setting, because a
 * settings name sits inside parentheses where CRG accepts no wildcard,
 * and the operator profiles can only be found by reading the names out
 * of those keys.
 */
export const SETTINGS_ROOT = 'ScoreBoard.Settings';

export type TeamNumber = 1 | 2;

export type ClockName = 'Period' | 'Jam' | 'Lineup' | 'Timeout' | 'Intermission';

export const CLOCK_NAMES: readonly ClockName[] = ['Period', 'Jam', 'Lineup', 'Timeout', 'Intermission'];

/** The label CRG computes for one of its own operator buttons. */
export type LabelName = 'Start' | 'Stop' | 'Timeout' | 'Undo' | 'Replaced';

/** A slot in a team's color set. CRG names them '<set>.<slot>'. */
export type ColorSlot = 'fg' | 'bg' | 'glow';

/**
 * The color sets a key reads, in the order it prefers them.
 *
 * 'operator' is the set CRG's own operator console uses. 'preset' is
 * what a game holds before anyone fills the operator set in, so it
 * stands in rather than a key going to its plain default.
 */
export const COLOR_SETS = ['operator', 'preset'] as const;

export type ColorSet = (typeof COLOR_SETS)[number];

/**
 * What CRG puts in a Label when the control is unavailable.
 *
 * A key showing this has nothing to do: during a timeout, for example,
 * Label(Start) holds it while Label(Stop) reads 'End Timeout'. CRG's
 * 'No Action' is not this: it is the name of a real action, the one that
 * cancels a replacement, and it can be replaced like any other.
 */
export const ACTION_NONE = '---';

/** The name CRG lists this device under, which it sends on connecting. */
export const DEVICE_NAME = 'WS.Device.Name';

/** The owner CRG gives an official timeout. An untyped timeout has none. */
export const OFFICIAL_OWNER = 'O';

/** True when a CRG label means the control cannot be used now. */
export function isUnavailable(labelText: string): boolean {
  return labelText === '' || labelText === ACTION_NONE;
}

/** Reads or writes a field on the current game. */
export function game(field: string): string {
  return `${CURRENT_GAME}.${field}`;
}

/** Reads or writes a field on one team of the current game. */
export function team(number: TeamNumber, field: string): string {
  return `${CURRENT_GAME}.Team(${number}).${field}`;
}

/** Reads or writes a field on one of the current game's clocks. */
export function clock(name: ClockName, field: string): string {
  return `${CURRENT_GAME}.Clock(${name}).${field}`;
}

/** Reads one slot of one of a team's color sets. */
export function teamColor(number: TeamNumber, slot: ColorSlot, set: ColorSet = 'operator'): string {
  return team(number, `Color(${set}.${slot})`);
}

/** Reads the label CRG shows on the matching operator button. */
export function label(name: LabelName): string {
  return game(`Label(${name})`);
}

/** Reads one of the current game's rules, such as 'Team.Timeouts'. */
export function rule(name: string): string {
  return game(`Rule(${name})`);
}

/** Reads one of CRG's scoreboard settings, which a league can change. */
export function setting(name: string): string {
  return `${SETTINGS_ROOT}.Setting(${name})`;
}

/**
 * Reads the team a key is set to, defaulting to the first.
 *
 * The property inspector stores the choice as text, so the value is
 * read as a number rather than compared to one.
 */
export function readTeam(value: unknown): TeamNumber {
  return Number(value) === 2 ? 2 : 1;
}

/** Each timeout CRG has recorded, under the period it happened in. */
export const TIMEOUTS = {
  running: `${CURRENT_GAME}.Period(*).Timeout(*).Running`,
  owner: `${CURRENT_GAME}.Period(*).Timeout(*).Owner`,
  review: `${CURRENT_GAME}.Period(*).Timeout(*).Review`,
  retained: `${CURRENT_GAME}.Period(*).Timeout(*).RetainedReview`
} as const;

/** How long each jam ran, under its period and number; CRG writes it when the jam stops. */
export const JAM_DURATIONS = `${CURRENT_GAME}.Period(*).Jam(*).Duration`;

/** Each jam's id and whether it is an overtime jam, under its period and number. */
export const JAMS = {
  id: `${CURRENT_GAME}.Period(*).Jam(*).Id`,
  overtime: `${CURRENT_GAME}.Period(*).Jam(*).Overtime`
} as const;

/** Whether each period went to JRDA sudden scoring. */
export const PERIOD_SUDDEN_SCORING = `${CURRENT_GAME}.Period(*).SuddenScoring`;

/** The id of every scoring trip; the trip's number is the key it sits under. */
export const SCORING_TRIP_IDS = `${CURRENT_GAME}.Period(*).Jam(*).TeamJam(*).ScoringTrip(*).Id`;

/** The labels CRG shows on its scoreboard when no period is running. */
export const INTERMISSION_LABELS = {
  preGame: setting('ScoreBoard.Intermission.PreGame'),
  intermission: setting('ScoreBoard.Intermission.Intermission'),
  unofficial: setting('ScoreBoard.Intermission.Unofficial'),
  official: setting('ScoreBoard.Intermission.Official'),
  officialWithClock: setting('ScoreBoard.Intermission.OfficialWithClock')
} as const;

/**
 * The automation settings the Automation page switches.
 *
 * Both are global, shared by every device, and CRG keeps each as the
 * text 'true' or 'false'.
 */
export const AUTOMATION_SETTINGS = {
  endJams: setting('ScoreBoard.AutoEndJam'),
  endTeamTimeouts: setting('ScoreBoard.AutoEndTTO')
} as const;

/** What a key in a team's colors draws from, for either team. */
export const TEAM_THEME_PATHS: readonly string[] = [
  `${CURRENT_GAME}.Team(*).Name`,
  `${CURRENT_GAME}.Team(*).UniformColor`,
  `${CURRENT_GAME}.Team(*).AlternateName(operator)`,
  `${CURRENT_GAME}.Team(*).Color(operator.*)`,
  `${CURRENT_GAME}.Team(*).Color(preset.*)`
];

/**
 * The paths the plugin registers for.
 *
 * Registering 'ScoreBoard.CurrentGame' whole would send every skater,
 * penalty, period, jam, and trip in the game, so each leaf is named.
 */
export const REGISTERED_PATHS: readonly string[] = [
  game('InJam'),
  game('InPeriod'),
  game('InOvertime'),
  game('NoMoreJam'),
  game('FiveSeconds'),
  game('InSuddenScoring'),
  game('InjuryContinuationUpcoming'),
  game('TimeoutOwner'),
  game('OfficialReview'),
  game('ReviewIsTo'),
  game('CurrentPeriodNumber'),
  game('OfficialScore'),
  game('InhibitFinalScore'),
  game('ClockDuringFinalScore'),
  game('Label(*)'),
  rule('Period.Number'),
  rule('Lineup.Duration'),
  rule('Lineup.OvertimeDuration'),
  rule('Team.Timeouts'),
  rule('Team.OfficialReviews'),
  rule('Team.MaxRetains'),
  rule('Jam.SuddenScoring'),
  rule('Jam.InjuryContinuation'),
  `${CURRENT_GAME}.Clock(*).Name`,
  `${CURRENT_GAME}.Clock(*).Time`,
  `${CURRENT_GAME}.Clock(*).Number`,
  `${CURRENT_GAME}.Clock(*).Running`,
  `${CURRENT_GAME}.Clock(*).Direction`,
  `${CURRENT_GAME}.Clock(*).InvertedTime`,
  `${CURRENT_GAME}.Clock(*).MaximumTime`,
  JAM_DURATIONS,
  ...Object.values(JAMS),
  PERIOD_SUDDEN_SCORING,
  `${CURRENT_GAME}.Team(*).Id`,
  `${CURRENT_GAME}.Team(*).Score`,
  `${CURRENT_GAME}.Team(*).JamScore`,
  `${CURRENT_GAME}.Team(*).TripScore`,
  `${CURRENT_GAME}.Team(*).CurrentTrip`,
  `${CURRENT_GAME}.Team(*).RunningOrEndedTeamJam`,
  `${CURRENT_GAME}.Team(*).NoInitial`,
  `${CURRENT_GAME}.Team(*).Lead`,
  `${CURRENT_GAME}.Team(*).Lost`,
  `${CURRENT_GAME}.Team(*).Calloff`,
  `${CURRENT_GAME}.Team(*).Injury`,
  `${CURRENT_GAME}.Team(*).StarPass`,
  `${CURRENT_GAME}.Team(*).NoPivot`,
  `${CURRENT_GAME}.Team(*).Timeouts`,
  `${CURRENT_GAME}.Team(*).OfficialReviews`,
  `${CURRENT_GAME}.Team(*).RetainedOfficialReview`,
  `${CURRENT_GAME}.Team(*).InTimeout`,
  `${CURRENT_GAME}.Team(*).InOfficialReview`,
  ...Object.values(TIMEOUTS),
  SCORING_TRIP_IDS,
  SETTINGS_ROOT,
  ...TEAM_THEME_PATHS,
  DEVICE_NAME
];
