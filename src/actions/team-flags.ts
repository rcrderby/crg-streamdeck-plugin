/**
 * Keys that show and flip one of a team's jam flags.
 *
 * Lead, Lost Lead, Star Pass, No Pivot, NI, and Injury each read a true
 * or false value CRG keeps for the team, show the top bar while it is
 * true, and flip it when pressed. Each is its own action, so it
 * is found by name and works as soon as it is placed.
 */

import { type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';

import { immediateScoring } from '../crg/game-state.ts';
import { JAMS, PERIOD_SUDDEN_SCORING, type TeamNumber, team } from '../crg/paths.ts';
import { type KeySpec } from '../render/key.ts';
import { injuryKey, jammerKey, lostLeadKey, noInitialKey } from '../render/designs.ts';
import { type TeamTheme } from '../render/theme.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { TeamKeyAction, type TeamSettings, teamOf, teamPaths, themeOf } from './team-key-action.ts';

/** The CRG field the Lost Lead key reads and flips. */
const LOST = 'Lost';

/** What tells whether CRG keeps lead for the jam a team's flags belong to. */
const LEAD_RULE_PATHS = [...Object.values(JAMS), PERIOD_SUDDEN_SCORING];

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

/** Lead is darkened, and does nothing, in a jam where CRG keeps no lead. */
export class Lead extends TeamFlagAction {
  protected override get field(): string {
    return 'Lead';
  }

  protected override watchedPaths(): readonly string[] {
    return [...this.teamPaths('Lead', 'RunningOrEndedTeamJam'), ...LEAD_RULE_PATHS];
  }

  protected override describe(settings: TeamSettings): KeySpec {
    return {
      ...super.describe(settings),
      subdued: immediateScoring(this.context.client.state, this.teamOf(settings))
    };
  }

  protected override draw(theme: TeamTheme, active: boolean): KeySpec {
    return jammerKey(theme, 'lead', active);
  }

  override onKeyDown(event: KeyDownEvent<TeamSettings>): void {
    if (immediateScoring(this.context.client.state, this.teamOf(event.payload.settings))) {
      return;
    }

    super.onKeyDown(event);
  }
}

/**
 * Lost Lead needs a full second held, since it sits beside Lead and undoes it.
 *
 * Its top bar fills toward the state the hold will leave the key in,
 * rather than a corner dial, which would compete with whatever color
 * the team brings. Like Lead, it is darkened and cannot be held in a jam
 * where CRG keeps no lead.
 */
export class LostLead extends HoldKeyAction<TeamSettings> {
  protected override watchedPaths(): readonly string[] {
    return [...teamPaths(LOST, 'RunningOrEndedTeamJam'), ...LEAD_RULE_PATHS];
  }

  protected override canHold(settings: TeamSettings): boolean {
    return !this.#refused(teamOf(settings));
  }

  protected override describe(settings: TeamSettings, actionId: string): KeySpec {
    const level = this.holdDone(actionId) ? 0 : this.holdLevel(actionId);

    return {
      ...lostLeadKey(
        themeOf(this.context.client.state, settings),
        this.shownValue(actionId, this.#lost(settings)),
        level
      ),
      subdued: this.#refused(teamOf(settings))
    };
  }

  /** Sets the flag, and shows the value set until CRG sends it back. */
  protected override completeHold(action: KeyAction<TeamSettings>, settings: TeamSettings): void {
    const value = !this.#lost(settings);

    this.awaitValue(action, value);
    this.context.client.set(team(teamOf(settings), LOST), value);
  }

  #lost(settings: TeamSettings): boolean {
    return this.context.client.state.getBoolean(team(teamOf(settings), LOST));
  }

  #refused(number: TeamNumber): boolean {
    return immediateScoring(this.context.client.state, number);
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
