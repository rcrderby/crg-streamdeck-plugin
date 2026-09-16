/**
 * Puts a fixed number of points on a team's current trip.
 *
 * CRG's TripScore is absolute rather than additive, so the key assigns
 * the points rather than adding to what the trip already holds. The
 * leading plus says what the key puts on the board.
 *
 * The key never outlines itself or dims: it is a button, and
 * the Score key shows what the trip holds.
 */

import { action, type KeyDownEvent } from '@elgato/streamdeck';

import { team } from '../crg/paths.ts';
import { type KeySpec } from '../render/key.ts';
import { tripPointsKey } from '../render/designs.ts';
import { TeamKeyAction, type TeamSettings } from './team-key-action.ts';

export type TripPointsSettings = TeamSettings & {
  points?: number | string;
};

/** CRG's own trip score buttons cover nought to four points. */
const MAX_POINTS = 4;

// The identifier keeps its original spelling on purpose. Stream Deck
// stores it against every key a person has already placed, so changing
// it would empty those keys rather than rename them.
@action({ UUID: 'com.rcrderby.crg-streamdeck.trip-score' })
export class TripPoints extends TeamKeyAction<TripPointsSettings> {
  protected override watchedPaths(): readonly string[] {
    return this.teamPaths();
  }

  protected override describe(settings: TripPointsSettings): KeySpec {
    return tripPointsKey(this.themeOf(settings), readPoints(settings));
  }

  override onKeyDown(event: KeyDownEvent<TripPointsSettings>): void {
    const settings = event.payload.settings;

    this.context.client.set(team(this.teamOf(settings), 'TripScore'), readPoints(settings));
  }
}

/** Reads the points a key is set to, held inside the range CRG accepts. */
function readPoints(settings: TripPointsSettings): number {
  const points = Number(settings.points ?? 0);

  if (!Number.isInteger(points)) {
    return 0;
  }

  return Math.min(MAX_POINTS, Math.max(0, points));
}
