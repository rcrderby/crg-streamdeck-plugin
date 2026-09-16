/**
 * A key that acts only once it has been held for a full second.
 *
 * Pressing starts the hold, and the key draws its dial filling. Letting
 * go early cancels it. At the full second the action runs while the key
 * is still down, so the operator does not have to judge when to let go.
 */

import type { KeyAction, KeyDownEvent, KeyUpEvent, WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { HOLD_MS, holdProgress } from '../render/hold.ts';
import { CrgKeyAction } from './key-action.ts';

type Hold = {
  readonly startedAt: number;
  readonly timer: NodeJS.Timeout;
  done: boolean;
};

export abstract class HoldKeyAction<T extends JsonObject = JsonObject> extends CrgKeyAction<T> {
  readonly #holds = new Map<string, Hold>();

  /**
   * Whether the key can act now.
   *
   * A key that cannot does nothing when pressed. It already looks unable
   * to act, subdued or dimmed, and an alert over a key that is plainly
   * out of action says nothing the key has not said.
   */
  protected canHold(_settings: T): boolean {
    return true;
  }

  /** Runs once the key has been held for the full time. */
  protected abstract completeHold(action: KeyAction<T>, settings: T): void | Promise<void>;

  /**
   * True once a key's hold has run, while the key is still down.
   *
   * A key whose hold has already acted has nothing left to report, and
   * what it shows belongs to the state CRG is about to send back.
   */
  protected holdDone(actionId: string): boolean {
    return this.#holds.get(actionId)?.done === true;
  }

  /** How far along a key's hold is, from 0 when it is not held to 1 once the hold is complete. */
  protected holdLevel(actionId: string): number {
    const hold = this.#holds.get(actionId);

    if (hold === undefined) {
      return 0;
    }

    return hold.done ? 1 : holdProgress(hold.startedAt, Date.now());
  }

  protected override animates(actionId: string, settings: T): boolean {
    const hold = this.#holds.get(actionId);

    return (hold !== undefined && !hold.done) || super.animates(actionId, settings);
  }

  override onKeyDown(event: KeyDownEvent<T>): void | Promise<void> {
    const { action } = event;
    const settings = event.payload.settings;

    if (!this.canHold(settings)) {
      return undefined;
    }

    this.#cancel(action.id);

    const hold: Hold = {
      startedAt: Date.now(),
      done: false,
      timer: setTimeout(() => {
        hold.done = true;
        this.redraw(action);
        void Promise.resolve(this.completeHold(action, settings)).catch(() => action.showAlert());
      }, HOLD_MS)
    };

    this.#holds.set(action.id, hold);
    this.redraw(action);

    return undefined;
  }

  override onKeyUp(event: KeyUpEvent<T>): void {
    this.#cancel(event.action.id);
    this.redraw(event.action);
  }

  override onWillDisappear(event: WillDisappearEvent<T>): void {
    this.#cancel(event.action.id);
    super.onWillDisappear(event);
  }

  #cancel(actionId: string): void {
    const hold = this.#holds.get(actionId);

    if (hold !== undefined) {
      clearTimeout(hold.timer);
      this.#holds.delete(actionId);
    }
  }
}
