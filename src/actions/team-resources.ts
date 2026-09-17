/**
 * Keys for what a team has left to spend: timeouts and official reviews.
 *
 * Each shows a dot per one left, subdues once none are left, and shows
 * the top bar while the team's timeout or review is running, with the
 * mark it used pulsing. Pressing it calls one.
 */

import { type KeyDownEvent } from '@elgato/streamdeck';

import { TIMEOUTS, game, rule, team } from '../crg/paths.ts';
import { reviewMark, reviewWins } from '../crg/game-state.ts';
import { type KeySpec } from '../render/key.ts';
import { officialReviewKey, teamTimeoutKey } from '../render/designs.ts';
import { pulseOpacity } from '../render/pulse.ts';
import { TeamKeyAction, type TeamSettings } from './team-key-action.ts';

/** CRG's default rules, used until the game's own rules arrive. */
const DEFAULT_TIMEOUTS = 3;

const DEFAULT_REVIEWS = 1;

export class TeamTimeout extends TeamKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [...this.teamPaths('Timeouts', 'InTimeout'), rule('Team.Timeouts')];
  }

  protected override describe(settings: TeamSettings): KeySpec {
    const state = this.context.client.state;
    const number = this.teamOf(settings);
    const total = state.getNumber(rule('Team.Timeouts'), DEFAULT_TIMEOUTS);
    const running = this.#running(settings);

    return teamTimeoutKey(
      this.themeOf(settings),
      total,
      state.getNumber(team(number, 'Timeouts'), total),
      running,
      running ? pulseOpacity(Date.now()) : undefined
    );
  }

  protected override animates(_actionId: string, settings: TeamSettings): boolean {
    return this.#running(settings);
  }

  override onKeyDown(event: KeyDownEvent<TeamSettings>): void {
    this.context.client.trigger(team(this.teamOf(event.payload.settings), 'Timeout'));
  }

  #running(settings: TeamSettings): boolean {
    return this.context.client.state.getBoolean(team(this.teamOf(settings), 'InTimeout'));
  }
}

/**
 * An Official Review key also marks a review the team has won this
 * period: a plus once, a line twice.
 *
 * While a review runs, CRG has already counted it, so the mark it used
 * is drawn as it looked before the review began.
 */
export class OfficialReview extends TeamKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [
      ...this.teamPaths('Id', 'OfficialReviews', 'InOfficialReview'),
      rule('Team.OfficialReviews'),
      game('CurrentPeriodNumber'),
      TIMEOUTS.owner,
      TIMEOUTS.review,
      TIMEOUTS.retained
    ];
  }

  protected override describe(settings: TeamSettings): KeySpec {
    const state = this.context.client.state;
    const number = this.teamOf(settings);
    const total = state.getNumber(rule('Team.OfficialReviews'), DEFAULT_REVIEWS);
    const left = state.getNumber(team(number, 'OfficialReviews'), total);
    const running = this.#running(settings);

    return officialReviewKey(
      this.themeOf(settings),
      total,
      left,
      reviewMark(running ? left + 1 : left, reviewWins(state, number)),
      running,
      running ? pulseOpacity(Date.now()) : undefined
    );
  }

  protected override animates(_actionId: string, settings: TeamSettings): boolean {
    return this.#running(settings);
  }

  override onKeyDown(event: KeyDownEvent<TeamSettings>): void {
    this.context.client.trigger(team(this.teamOf(event.payload.settings), 'OfficialReview'));
  }

  #running(settings: TeamSettings): boolean {
    return this.context.client.state.getBoolean(team(this.teamOf(settings), 'InOfficialReview'));
  }
}
