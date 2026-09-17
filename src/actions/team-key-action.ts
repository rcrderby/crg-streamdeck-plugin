/**
 * What a key drawn in one team's colors has in common.
 *
 * The team is a setting, so one action serves either team. The key
 * redraws when the team's name or colors change, as well as when its
 * own paths do.
 */

import type { JsonObject } from '@elgato/utils';

import { CURRENT_GAME, TEAM_THEME_PATHS, type TeamNumber, readTeam } from '../crg/paths.ts';
import { type StateStore } from '../crg/state.ts';
import { type TeamTheme, teamTheme } from '../render/theme.ts';
import { CrgKeyAction } from './key-action.ts';

export type TeamSettings = JsonObject & {
  team?: TeamNumber | string;
};

/** The team a key is set to, defaulting to the first. */
export function teamOf(settings: TeamSettings): TeamNumber {
  return readTeam(settings.team);
}

/** The colors a key draws in, for the team it is set to. */
export function themeOf(state: StateStore, settings: TeamSettings): TeamTheme {
  return teamTheme(state, teamOf(settings));
}

/** The paths a team key's colors come from, plus the named fields, for both teams. */
export function teamPaths(...fields: string[]): string[] {
  return [...TEAM_THEME_PATHS, ...fields.map((field) => `${CURRENT_GAME}.Team(*).${field}`)];
}

export abstract class TeamKeyAction<T extends TeamSettings = TeamSettings> extends CrgKeyAction<T> {
  protected teamOf(settings: T): TeamNumber {
    return teamOf(settings);
  }

  protected themeOf(settings: T): TeamTheme {
    return themeOf(this.context.client.state, settings);
  }

  protected teamPaths(...fields: string[]): string[] {
    return teamPaths(...fields);
  }
}
