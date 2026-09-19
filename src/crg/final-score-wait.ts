/**
 * How long until CRG allows the official score, as nearly as the plugin can tell.
 *
 * CRG does not publish the wait. While either team has an official review
 * left, it holds the score back for a lineup's length after each jam ends,
 * and for ten seconds after each score change. This follows the same
 * events as they arrive, so the figure can be a moment off, and it knows
 * nothing of a wait that began before the plugin was watching.
 */

import { CURRENT_GAME, game, rule, team } from './paths.ts';
import { parseClock } from '../render/time.ts';
import { type StateStore } from './state.ts';

/** How long CRG holds the score back after a score changes. */
const AFTER_SCORE_MS = 10_000;

const IN_JAM = game('InJam');

const SCORES = `${CURRENT_GAME}.Team(*).Score`;

export class FinalScoreWait {
  readonly #state: StateStore;

  /** When the wait ends, or undefined when the plugin has not seen it begin. */
  #until: number | undefined;

  #inJam: boolean | undefined;
  #scores: string | undefined;

  constructor(state: StateStore) {
    this.#state = state;
    this.#inJam = this.#readInJam();
    this.#scores = this.#readScores();
    state.subscribe([IN_JAM, SCORES], () => this.#observe());
  }

  /** The time left, or undefined when the plugin cannot say. */
  remaining(now = Date.now()): number | undefined {
    return this.#until === undefined ? undefined : Math.max(0, this.#until - now);
  }

  /** Drops what the plugin saw, as when it loses CRG and cannot know what happened meanwhile. */
  forget(): void {
    this.#until = undefined;
    this.#inJam = undefined;
    this.#scores = undefined;
  }

  #observe(): void {
    const inJam = this.#readInJam();
    const scores = this.#readScores();
    const now = Date.now();

    if (this.#inJam === true && inJam === false && this.#reviewsLeft()) {
      this.#until = now + parseClock(this.#state.getString(rule('Lineup.Duration')));
    }

    if (this.#scores !== undefined && scores !== undefined && scores !== this.#scores && this.#reviewsLeft()) {
      this.#until = Math.max(this.#until ?? 0, now + AFTER_SCORE_MS);
    }

    this.#inJam = inJam;
    this.#scores = scores;
  }

  #readInJam(): boolean | undefined {
    return this.#state.get(IN_JAM) !== undefined ? this.#state.getBoolean(IN_JAM) : undefined;
  }

  /** Both scores as one value, or undefined until CRG has sent both. */
  #readScores(): string | undefined {
    if (this.#state.get(team(1, 'Score')) === undefined || this.#state.get(team(2, 'Score')) === undefined) {
      return undefined;
    }

    return `${this.#state.getNumber(team(1, 'Score'))}:${this.#state.getNumber(team(2, 'Score'))}`;
  }

  #reviewsLeft(): boolean {
    return (
      this.#state.getNumber(team(1, 'OfficialReviews')) > 0 || this.#state.getNumber(team(2, 'OfficialReviews')) > 0
    );
  }
}
