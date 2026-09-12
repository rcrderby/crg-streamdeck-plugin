/**
 * Paths into the CRG scoreboard state.
 *
 * CRG addresses everything by a dotted path, and 'ScoreBoard.CurrentGame'
 * mirrors whichever game is loaded for both reads and writes, so no part
 * of the plugin tracks a game identifier.
 */

export const CURRENT_GAME = 'ScoreBoard.CurrentGame';

export type TeamNumber = 1 | 2;

export type ClockName = 'Period' | 'Jam' | 'Lineup' | 'Timeout' | 'Intermission';

export const CLOCK_NAMES: readonly ClockName[] = ['Period', 'Jam', 'Lineup', 'Timeout', 'Intermission'];

/** The label CRG computes for one of its own operator buttons. */
export type LabelName = 'Start' | 'Stop' | 'Timeout' | 'Undo' | 'Replaced';

/** A slot in a team's color set. CRG names them '<set>.<slot>'. */
export type ColorSlot = 'fg' | 'bg' | 'glow';

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

/** Reads one slot of a team's 'operator' color set. */
export function teamColor(number: TeamNumber, slot: ColorSlot): string {
  return team(number, `Color(operator.${slot})`);
}

/** Reads the label CRG shows on the matching operator button. */
export function label(name: LabelName): string {
  return game(`Label(${name})`);
}

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
  game('TimeoutOwner'),
  game('OfficialReview'),
  game('ReviewIsTo'),
  game('Label(*)'),
  `${CURRENT_GAME}.Clock(*).Time`,
  `${CURRENT_GAME}.Clock(*).Number`,
  `${CURRENT_GAME}.Clock(*).Running`,
  `${CURRENT_GAME}.Clock(*).Direction`,
  `${CURRENT_GAME}.Clock(*).InvertedTime`,
  `${CURRENT_GAME}.Team(*).Score`,
  `${CURRENT_GAME}.Team(*).JamScore`,
  `${CURRENT_GAME}.Team(*).TripScore`,
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
  `${CURRENT_GAME}.Team(*).Name`,
  `${CURRENT_GAME}.Team(*).UniformColor`,
  `${CURRENT_GAME}.Team(*).AlternateName(operator)`,
  `${CURRENT_GAME}.Team(*).Color(operator.*)`
];
