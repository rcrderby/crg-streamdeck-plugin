/**
 * The End of Period Controls key, and the page of controls it opens.
 *
 * The page holds CRG's own four, in CRG's order: Official Score, Timeout
 * Before Period End, Start Overtime Lineup, and Show Clock During Final
 * Score. Official Score and Start Overtime Lineup each act once held and
 * only one way, since CRG has nothing that undoes either from the deck.
 */

import { type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { FinalScoreWait } from '../crg/final-score-wait.ts';
import { CURRENT_GAME, game, label } from '../crg/paths.ts';
import { type KeySpec } from '../render/key.ts';
import {
  type OfficialScoreState,
  type OvertimeState,
  clockDuringFinalScoreKey,
  endOfPeriodKey,
  officialScoreKey,
  overtimeLineupKey,
  periodEndTimeoutKey
} from '../render/designs.ts';
import { formatClock } from '../render/time.ts';
import { CrgKeyAction } from './key-action.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { movePage, openPage } from './navigation.ts';

const OFFICIAL_SCORE = game('OfficialScore');

const INHIBIT_FINAL_SCORE = game('InhibitFinalScore');

const IN_OVERTIME = game('InOvertime');

const CLOCK_DURING_FINAL_SCORE = game('ClockDuringFinalScore');

/** What CRG's stop control reads exactly when it offers an overtime lineup. */
const OVERTIME_LINEUP = 'Overtime Lineup';

export class EndOfPeriod extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [];
  }

  /** Shows nothing from CRG, so there is nothing to veil. */
  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(): KeySpec {
    return endOfPeriodKey();
  }

  override async onKeyDown(event: KeyDownEvent): Promise<void> {
    await openPage(event.action, 'end-of-period');
  }
}

/**
 * Official Score: makes the score official once held.
 *
 * CRG refuses the change while it publishes InhibitFinalScore, so the key
 * is darkened then, with the plugin's estimate of the wait.
 */
export class OfficialScore extends HoldKeyAction {
  readonly #wait = new FinalScoreWait(this.context.client.state);

  constructor(...args: ConstructorParameters<typeof HoldKeyAction>) {
    super(...args);
    this.context.client.on('status', (status) => {
      if (status !== 'connected' && status !== 'unauthorized') {
        this.#wait.forget();
      }
    });
  }

  protected override watchedPaths(): readonly string[] {
    // A jam ending or a score changing starts the wait the key counts down.
    return [OFFICIAL_SCORE, INHIBIT_FINAL_SCORE, game('InJam'), `${CURRENT_GAME}.Team(*).Score`];
  }

  /** Counts the wait down while CRG holds the score back and the plugin knows how long for. */
  protected override animates(actionId: string, settings: JsonObject): boolean {
    return (this.#state() === 'waiting' && (this.#wait.remaining() ?? 0) > 0) || super.animates(actionId, settings);
  }

  /**
   * The wait is counted in whole seconds, so it is drawn once a second.
   *
   * A hold is not: its bar has to fill smoothly, so it draws on every
   * tick like every other held key.
   */
  protected override animationPeriodMs(actionId: string): number {
    return this.holding(actionId) ? 0 : 1_000;
  }

  protected override canHold(): boolean {
    return this.#state() === 'ready';
  }

  protected override describe(_settings: object, actionId: string): KeySpec {
    const state = this.shownValue(actionId, this.#state() === 'official') ? 'official' : this.#state();
    const remaining = this.#wait.remaining();
    const wait =
      state === 'waiting' && remaining !== undefined && remaining > 0 ? formatClock(remaining, true) : undefined;
    const level = this.holdDone(actionId) ? 0 : this.holdLevel(actionId);

    return officialScoreKey(state, wait, level);
  }

  /** Sets the score official, and shows it so until CRG sends it back. */
  protected override completeHold(action: KeyAction): void {
    this.awaitValue(action, true);
    this.context.client.set(OFFICIAL_SCORE, true);
  }

  #state(): OfficialScoreState {
    const state = this.context.client.state;

    if (state.getBoolean(OFFICIAL_SCORE)) {
      return 'official';
    }

    return state.getBoolean(INHIBIT_FINAL_SCORE) ? 'waiting' : 'ready';
  }
}

/** Timeout Before Period End: opens its page, with the seconds back at the one they start from. */
export class PeriodEndTimeout extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [];
  }

  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(): KeySpec {
    return periodEndTimeoutKey();
  }

  override async onKeyDown(event: KeyDownEvent): Promise<void> {
    this.context.periodEndSeconds.reset();
    await movePage(event.action, 'period-end-timeout');
  }
}

/**
 * Start Overtime Lineup: starts CRG's overtime lineup once held.
 *
 * It follows CRG's own offer, which CRG makes by reading Overtime Lineup
 * on its stop control: the last period over, the scores tied, and the
 * score not yet official.
 */
export class OvertimeLineup extends HoldKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [label('Stop'), IN_OVERTIME];
  }

  protected override canHold(): boolean {
    return this.#state() === 'ready';
  }

  protected override describe(_settings: object, actionId: string): KeySpec {
    const level = this.holdDone(actionId) ? 0 : this.holdLevel(actionId);

    return overtimeLineupKey(
      this.shownValue(actionId, this.#state() === 'overtime') ? 'overtime' : this.#state(),
      level
    );
  }

  /** Starts the lineup, and shows the game in overtime until CRG sends it back. */
  protected override completeHold(action: KeyAction): void {
    this.awaitValue(action, true);
    this.context.client.trigger(game('StartOvertime'));
  }

  #state(): OvertimeState {
    const state = this.context.client.state;

    if (state.getBoolean(IN_OVERTIME)) {
      return 'overtime';
    }

    return state.getString(label('Stop')) === OVERTIME_LINEUP ? 'ready' : 'unavailable';
  }
}

/** Show Clock During Final Score: flips CRG's game setting with a press. */
export class ClockDuringFinalScore extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [CLOCK_DURING_FINAL_SCORE];
  }

  protected override describe(): KeySpec {
    return clockDuringFinalScoreKey(this.#on());
  }

  override onKeyDown(): void {
    this.context.client.set(CLOCK_DURING_FINAL_SCORE, !this.#on());
  }

  #on(): boolean {
    return this.context.client.state.getBoolean(CLOCK_DURING_FINAL_SCORE);
  }
}
