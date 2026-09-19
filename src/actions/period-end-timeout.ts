/**
 * The keys on the Timeout Before Period End page.
 *
 * The page starts an untyped timeout and leaves the period clock at a
 * number of seconds the operator picks, as CRG's own dialog does: the
 * timeout first, which stops the period clock, then the time. The
 * seconds start at one each time the page opens and go down to zero.
 */

import { type KeyAction } from '@elgato/streamdeck';

import { clock, game } from '../crg/paths.ts';
import { type KeySpec } from '../render/key.ts';
import { periodEndSecondsKey, secondsStepKey, startPeriodEndTimeoutKey } from '../render/designs.ts';
import { formatClock } from '../render/time.ts';
import { type PluginContext } from '../context.ts';
import { CrgKeyAction } from './key-action.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { returnToLayout } from './navigation.ts';

/** A key on the page, redrawn whenever the seconds change. */
abstract class SecondsKey extends CrgKeyAction {
  constructor(context: PluginContext) {
    super(context);
    context.periodEndSeconds.onChange(() => this.redrawAll());
  }

  protected override watchedPaths(): readonly string[] {
    return [];
  }

  /** Reads the page's own count rather than CRG, so there is nothing to veil. */
  protected override get subduedWhileOffline(): boolean {
    return false;
  }
}

/** The seconds the period clock will be left at. It only shows. */
export class SecondsAtTimeout extends SecondsKey {
  protected override describe(): KeySpec {
    return periodEndSecondsKey(formatClock(this.context.periodEndSeconds.value * 1000));
  }
}

abstract class SecondsStep extends SecondsKey {
  protected abstract get by(): number;

  protected override describe(): KeySpec {
    return secondsStepKey(this.by > 0, this.by > 0 || this.context.periodEndSeconds.value > 0);
  }

  override onKeyDown(): void {
    this.context.periodEndSeconds.step(this.by);
  }
}

export class SecondsUp extends SecondsStep {
  protected override get by(): number {
    return 1;
  }
}

export class SecondsDown extends SecondsStep {
  protected override get by(): number {
    return -1;
  }
}

/** Start Timeout: once held, starts the timeout, sets the period clock, and returns the deck to the layout. */
export class StartPeriodEndTimeout extends HoldKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [];
  }

  protected override describe(_settings: object, actionId: string): KeySpec {
    return startPeriodEndTimeoutKey(this.holdDone(actionId) ? 0 : this.holdLevel(actionId));
  }

  protected override async completeHold(action: KeyAction): Promise<void> {
    this.context.client.trigger(game('Timeout'));
    this.context.client.set(clock('Period', 'Time'), this.context.periodEndSeconds.value * 1000);
    await returnToLayout(action);
  }
}
