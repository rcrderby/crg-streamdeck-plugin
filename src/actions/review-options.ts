/**
 * Official Review Options: marks a team's running review as retained, or as taken as a team timeout.
 *
 * One action serves both, chosen in the key's settings, for either team.
 * Each flips with a press, and only while that team's review is running;
 * otherwise the key is darkened and a press does nothing.
 */

import { type KeyDownEvent } from '@elgato/streamdeck';

import { TIMEOUTS, game, rule, team } from '../crg/paths.ts';
import { reviewWins } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { type ReviewOption, reviewOptionKey } from '../render/designs.ts';
import { TeamKeyAction, type TeamSettings } from './team-key-action.ts';

export type ReviewOptionSettings = TeamSettings & {
  option?: ReviewOption | string;
};

/** CRG's default for how many reviews a team may retain, used until the game's own rules arrive. */
const DEFAULT_RETAINS = 1;

/** The option a key is set to, defaulting to Review Retained. */
export function optionOf(settings: ReviewOptionSettings): ReviewOption {
  return settings.option === 'timeout' ? 'timeout' : 'retained';
}

export class ReviewOptions extends TeamKeyAction<ReviewOptionSettings> {
  protected override watchedPaths(): readonly string[] {
    return [
      ...this.teamPaths('Id', 'InOfficialReview', 'RetainedOfficialReview'),
      game('ReviewIsTo'),
      game('CurrentPeriodNumber'),
      rule('Team.MaxRetains'),
      TIMEOUTS.owner,
      TIMEOUTS.review,
      TIMEOUTS.retained
    ];
  }

  protected override describe(settings: ReviewOptionSettings): KeySpec {
    const option = optionOf(settings);
    const running = this.#running(settings);

    return reviewOptionKey(
      this.themeOf(settings),
      option,
      running && this.#set(settings),
      running,
      option === 'retained' && this.#noRetainsLeft(settings)
    );
  }

  override onKeyDown(event: KeyDownEvent<ReviewOptionSettings>): void {
    const settings = event.payload.settings;

    if (!this.#running(settings)) {
      return;
    }

    this.context.client.set(this.#path(settings), !this.#set(settings));
  }

  /** The value the key flips: the team's retained flag, or CRG's one flag for a review taken as a timeout. */
  #path(settings: ReviewOptionSettings): string {
    return optionOf(settings) === 'timeout'
      ? game('ReviewIsTo')
      : team(this.teamOf(settings), 'RetainedOfficialReview');
  }

  #set(settings: ReviewOptionSettings): boolean {
    return this.context.client.state.getBoolean(this.#path(settings));
  }

  #running(settings: ReviewOptionSettings): boolean {
    return this.context.client.state.getBoolean(team(this.teamOf(settings), 'InOfficialReview'));
  }

  /**
   * True once the team has used every retain the rules allow this period, before the review now running.
   *
   * CRG spends a retain on each retained review in turn, so a review won
   * after the last one is spent is recorded but keeps nothing.
   */
  #noRetainsLeft(settings: ReviewOptionSettings): boolean {
    const state = this.context.client.state;
    const number = this.teamOf(settings);
    const wins = reviewWins(state, number);
    const current = this.#running(settings) && state.getBoolean(team(number, 'RetainedOfficialReview')) ? 1 : 0;

    return wins - current >= state.getNumber(rule('Team.MaxRetains'), DEFAULT_RETAINS);
  }
}
