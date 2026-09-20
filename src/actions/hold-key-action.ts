/**
 * A key that acts only once it has been held for a full second.
 *
 * Pressing starts the hold, and the key draws it filling: on its top
 * bar, or on a dial when the key has no bar. Letting go early cancels
 * it. At the full second the action runs while the key is still down,
 * so the operator does not have to judge when to let go.
 */

import type { KeyAction, KeyDownEvent, KeyUpEvent, WillDisappearEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { HOLD_MS, holdProgress } from '../render/hold.ts';
import { CrgKeyAction } from './key-action.ts';

/** How long a finished hold's value is shown before the key goes back to what CRG holds, if CRG has not answered. */
const AWAIT_MS = 2000;

type Hold = {
  readonly startedAt: number;
  readonly timer: NodeJS.Timeout;
  done: boolean;
};

export abstract class HoldKeyAction<T extends JsonObject = JsonObject> extends CrgKeyAction<T> {
  readonly #holds = new Map<string, Hold>();

  /** The value a finished hold set, per key, shown until CRG reports it back. */
  readonly #awaiting = new Map<string, { value: boolean; timer: NodeJS.Timeout }>();

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

  /** True from the moment a key is pressed until the hold ends, whether it acted or was let go. */
  protected holding(actionId: string): boolean {
    return this.#holds.has(actionId);
  }

  /** How far along a key's hold is, from 0 when it is not held to 1 once the hold is complete. */
  protected holdLevel(actionId: string): number {
    const hold = this.#holds.get(actionId);

    if (hold === undefined) {
      return 0;
    }

    return hold.done ? 1 : holdProgress(hold.startedAt, Date.now());
  }

  /**
   * Remembers the value a finished hold set, so the key can show it until CRG sends it back.
   *
   * Between the write and CRG's answer the key would otherwise draw the
   * old value for a moment, a flash of the color the hold just left. If
   * CRG never takes the change, the key goes back to CRG's value.
   */
  protected awaitValue(action: { id: string }, value: boolean): void {
    clearTimeout(this.#awaiting.get(action.id)?.timer);
    this.#awaiting.set(action.id, {
      value,
      timer: setTimeout(() => {
        this.#awaiting.delete(action.id);
        this.redraw(action);
      }, AWAIT_MS)
    });
  }

  /** What a key shows: the value a finished hold set until CRG agrees, then CRG's own. */
  protected shownValue(actionId: string, current: boolean): boolean {
    const awaiting = this.#awaiting.get(actionId);

    if (awaiting === undefined) {
      return current;
    }

    if (awaiting.value === current) {
      clearTimeout(awaiting.timer);
      this.#awaiting.delete(actionId);
    }

    return awaiting.value;
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
        void this.#complete(action, settings).catch(() => action.showAlert());
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
    this.#stopWaiting(event.action.id);
    super.onWillDisappear(event);
  }

  /** Runs the hold's action at once, turning a failure it throws into one it reports. */
  #complete(action: KeyAction<T>, settings: T): Promise<void> {
    try {
      return Promise.resolve(this.completeHold(action, settings));
    } catch (cause) {
      return Promise.reject(cause instanceof Error ? cause : new Error(String(cause)));
    }
  }

  /** Drops the wait for CRG's answer, so a key taken off the deck leaves no timer behind. */
  #stopWaiting(actionId: string): void {
    const awaiting = this.#awaiting.get(actionId);

    if (awaiting !== undefined) {
      clearTimeout(awaiting.timer);
      this.#awaiting.delete(actionId);
    }
  }

  #cancel(actionId: string): void {
    const hold = this.#holds.get(actionId);

    if (hold !== undefined) {
      clearTimeout(hold.timer);
      this.#holds.delete(actionId);
    }
  }
}
