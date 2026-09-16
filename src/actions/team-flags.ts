/**
 * Keys that show and flip one of a team's jam flags.
 *
 * Lead, Lost Lead, Star Pass, No Pivot, NI, and Injury each read a true
 * or false value CRG keeps for the team, show the top bar while it is
 * true, and flip it when pressed. Each is its own action, so it
 * is found by name and works as soon as it is placed.
 */

import { type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';

import { team } from '../crg/paths.ts';
import { type KeySpec } from '../render/key.ts';
import { injuryKey, jammerKey, lostLeadKey, noInitialKey } from '../render/designs.ts';
import { type TeamTheme } from '../render/theme.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { TeamKeyAction, type TeamSettings, teamOf, teamPaths, themeOf } from './team-key-action.ts';

/** The CRG field the Lost Lead key reads and flips. */
const LOST = 'Lost';

abstract class TeamFlagAction extends TeamKeyAction {
  /** The CRG field this key reads and flips. */
  protected abstract get field(): string;

  protected abstract draw(theme: TeamTheme, active: boolean): KeySpec;

  protected override watchedPaths(): readonly string[] {
    return this.teamPaths(this.field);
  }

  protected override describe(settings: TeamSettings): KeySpec {
    const active = this.context.client.state.getBoolean(team(this.teamOf(settings), this.field));

    return this.draw(this.themeOf(settings), active);
  }

  override onKeyDown(event: KeyDownEvent<TeamSettings>): void {
    const path = team(this.teamOf(event.payload.settings), this.field);

    this.context.client.set(path, !this.context.client.state.getBoolean(path));
  }
}

export class Lead extends TeamFlagAction {
  protected override get field(): string {
    return 'Lead';
  }

  protected override draw(theme: TeamTheme, active: boolean): KeySpec {
    return jammerKey(theme, 'lead', active);
  }
}

/**
 * Lost Lead needs a full second held, since it sits beside Lead and undoes it.
 *
 * Its top bar fills toward the state the hold will leave the key in,
 * rather than a corner dial, which would compete with whatever color
 * the team brings.
 */
export class LostLead extends HoldKeyAction<TeamSettings> {
  protected override watchedPaths(): readonly string[] {
    return teamPaths(LOST);
  }

  protected override describe(settings: TeamSettings, actionId: string): KeySpec {
    const level = this.holdDone(actionId) ? 0 : this.holdLevel(actionId);

    return lostLeadKey(themeOf(this.context.client.state, settings), this.#lost(settings), level);
  }

  protected override completeHold(_action: KeyAction<TeamSettings>, settings: TeamSettings): void {
    this.context.client.set(team(teamOf(settings), LOST), !this.#lost(settings));
  }

  #lost(settings: TeamSettings): boolean {
    return this.context.client.state.getBoolean(team(teamOf(settings), LOST));
  }
}

/**
 * CRG ignores Star Pass for a team skating without a pivot, so while No
 * Pivot is on the key is subdued, says why, and does nothing when pressed.
 */
export class StarPass extends TeamFlagAction {
  protected override get field(): string {
    return 'StarPass';
  }

  protected override watchedPaths(): readonly string[] {
    return this.teamPaths('StarPass', 'NoPivot');
  }

  protected override describe(settings: TeamSettings): KeySpec {
    const state = this.context.client.state;
    const number = this.teamOf(settings);
    const noPivot = state.getBoolean(team(number, 'NoPivot'));

    return jammerKey(
      this.themeOf(settings),
      'starPass',
      state.getBoolean(team(number, 'StarPass')),
      noPivot ? 'NO PIVOT' : undefined
    );
  }

  protected override draw(theme: TeamTheme, active: boolean): KeySpec {
    return jammerKey(theme, 'starPass', active);
  }

  override onKeyDown(event: KeyDownEvent<TeamSettings>): void {
    if (this.context.client.state.getBoolean(team(this.teamOf(event.payload.settings), 'NoPivot'))) {
      return;
    }

    super.onKeyDown(event);
  }
}

export class NoPivot extends TeamFlagAction {
  protected override get field(): string {
    return 'NoPivot';
  }

  protected override draw(theme: TeamTheme, active: boolean): KeySpec {
    return jammerKey(theme, 'noPivot', active);
  }
}

/** NI is active while CRG's NoInitial is true: the jammer has not finished their initial trip. */
export class NoInitial extends TeamFlagAction {
  protected override get field(): string {
    return 'NoInitial';
  }

  protected override draw(theme: TeamTheme, active: boolean): KeySpec {
    return noInitialKey(theme, active);
  }
}

/** Injury is drawn in its own colors rather than the team's, since the state outranks the team. */
export class Injury extends TeamFlagAction {
  protected override get field(): string {
    return 'Injury';
  }

  protected override draw(_theme: TeamTheme, active: boolean): KeySpec {
    return injuryKey(active);
  }
}
