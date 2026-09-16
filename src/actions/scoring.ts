/**
 * Keys that change a team's trips and trip points, and the Score key.
 *
 * Every scoring key carries the team name at the top, in the team's
 * colors. Score only displays, so it carries the blue mark instead of
 * doing anything when pressed.
 */

import { action, type KeyDownEvent } from '@elgato/streamdeck';

import { SCORING_TRIP_IDS, team } from '../crg/paths.ts';
import { currentTripNumber } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { scoreKey, tripAdjustKey, tripChangeKey } from '../render/designs.ts';
import { TeamKeyAction, type TeamSettings } from './team-key-action.ts';

/** Up 1 and Down 1 change the current trip's points relative to what it holds. */
abstract class TripAdjust extends TeamKeyAction {
  protected abstract get up(): boolean;

  protected override watchedPaths(): readonly string[] {
    return this.teamPaths();
  }

  protected override describe(settings: TeamSettings): KeySpec {
    return tripAdjustKey(this.themeOf(settings), this.up);
  }

  override onKeyDown(event: KeyDownEvent<TeamSettings>): void {
    this.context.client.set(team(this.teamOf(event.payload.settings), 'TripScore'), this.up ? 1 : -1, 'change');
  }
}

@action({ UUID: 'com.rcrderby.crg-streamdeck.trip-points-up' })
export class TripPointsUp extends TripAdjust {
  protected override get up(): boolean {
    return true;
  }
}

@action({ UUID: 'com.rcrderby.crg-streamdeck.trip-points-down' })
export class TripPointsDown extends TripAdjust {
  protected override get up(): boolean {
    return false;
  }
}

/** Add Trip and Remove Trip trigger CRG's own controls for the team. */
abstract class TripChange extends TeamKeyAction {
  protected abstract get add(): boolean;

  protected override watchedPaths(): readonly string[] {
    return this.teamPaths();
  }

  protected override describe(settings: TeamSettings): KeySpec {
    return tripChangeKey(this.themeOf(settings), this.add);
  }

  override onKeyDown(event: KeyDownEvent<TeamSettings>): void {
    this.context.client.trigger(team(this.teamOf(event.payload.settings), this.add ? 'AddTrip' : 'RemoveTrip'));
  }
}

@action({ UUID: 'com.rcrderby.crg-streamdeck.add-trip' })
export class AddTrip extends TripChange {
  protected override get add(): boolean {
    return true;
  }
}

@action({ UUID: 'com.rcrderby.crg-streamdeck.remove-trip' })
export class RemoveTrip extends TripChange {
  protected override get add(): boolean {
    return false;
  }
}

@action({ UUID: 'com.rcrderby.crg-streamdeck.score' })
export class Score extends TeamKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [...this.teamPaths('Score', 'JamScore', 'CurrentTrip'), SCORING_TRIP_IDS];
  }

  protected override describe(settings: TeamSettings): KeySpec {
    const state = this.context.client.state;
    const number = this.teamOf(settings);

    return scoreKey(
      this.themeOf(settings),
      state.getNumber(team(number, 'Score')),
      state.getNumber(team(number, 'JamScore')),
      currentTripNumber(state, number)
    );
  }
}
