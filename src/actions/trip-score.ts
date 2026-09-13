/**
 * Puts a fixed number of points on a team's current trip.
 *
 * The key is drawn in that team's 'operator' colors, the set CRG's own
 * operator console uses, so a key matches the console the operator
 * looks up at.
 *
 * CRG's TripScore is absolute rather than additive, so the key assigns
 * the points rather than adding to what the trip already holds. The
 * leading plus says what the key puts on the board.
 */

import { action, type KeyDownEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { type KeySpec } from '../render/key.ts';
import { type TeamNumber, team, teamColor } from '../crg/paths.ts';
import { CrgKeyAction } from './key-action.ts';
import { teamTheme } from '../render/theme.ts';

export type TripScoreSettings = JsonObject & {
  team?: TeamNumber | string;
  points?: number | string;
};

const TEAMS: readonly TeamNumber[] = [1, 2];

/** CRG's own trip score buttons cover nought to four points. */
const MAX_POINTS = 4;

@action({ UUID: 'com.rcrderby.crg-streamdeck.trip-score' })
export class TripScore extends CrgKeyAction<TripScoreSettings> {
  protected override watchedPaths(): readonly string[] {
    return TEAMS.flatMap((number) => [
      team(number, 'TripScore'),
      team(number, 'NoInitial'),
      team(number, 'Name'),
      team(number, 'UniformColor'),
      team(number, 'AlternateName(operator)'),
      teamColor(number, 'bg'),
      teamColor(number, 'fg'),
      teamColor(number, 'glow')
    ]);
  }

  protected override describe(settings: TripScoreSettings): KeySpec {
    const number = readTeam(settings);
    const points = readPoints(settings);
    const theme = teamTheme(this.context.client.state, number);

    const current = this.context.client.state.getNumber(team(number, 'TripScore'), -1);
    const noInitial = this.context.client.state.getBoolean(team(number, 'NoInitial'));

    return {
      background: theme.background,
      foreground: theme.foreground,
      accent: theme.glow ?? undefined,
      outline: current === points ? theme.foreground : undefined,
      texts: [
        { text: theme.name.slice(0, 10), y: 24, size: 11, weight: 'bold', opacity: 0.8 },
        { text: `+${points}`, y: 76, size: 40, weight: 'bold', opacity: noInitial ? 0.5 : 1 }
      ]
    };
  }

  override onKeyDown(event: KeyDownEvent<TripScoreSettings>): void {
    const number = readTeam(event.payload.settings);

    this.context.client.set(team(number, 'TripScore'), readPoints(event.payload.settings));
  }
}

/**
 * Reads the team a key is set to, defaulting to the first.
 *
 * The property inspector stores the choice as text, so the value is
 * read as a number rather than compared to one.
 */
function readTeam(settings: TripScoreSettings): TeamNumber {
  return Number(settings.team) === 2 ? 2 : 1;
}

/** Reads the points a key is set to, held inside the range CRG accepts. */
function readPoints(settings: TripScoreSettings): number {
  const points = Number(settings.points ?? 0);

  if (!Number.isInteger(points)) {
    return 0;
  }

  return Math.min(MAX_POINTS, Math.max(0, points));
}
