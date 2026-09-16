/**
 * The keys on the connection page: Back, and the key that connects or disconnects.
 *
 * Neither is ever veiled, since the page is where a disconnected deck is
 * connected again.
 */

import { type KeyAction, type KeyDownEvent } from '@elgato/streamdeck';

import { type KeySpec } from '../render/key.ts';
import { backKey, connectionToggleKey } from '../render/designs.ts';
import { CrgKeyAction } from './key-action.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { returnToLayout } from './navigation.ts';

export class Back extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [];
  }

  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(): KeySpec {
    return backKey();
  }

  override onKeyDown(event: KeyDownEvent): Promise<void> {
    return returnToLayout(event.action);
  }
}

/**
 * Connects or disconnects once held.
 *
 * It reads Hold to disconnect whenever the plugin is connected or trying
 * to be, so a hold also stops the retries, and Hold to connect once the
 * deck has been disconnected on purpose.
 */
export class ConnectionToggle extends HoldKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [];
  }

  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(_settings: object, actionId: string): KeySpec {
    // Once the hold has acted, the bar belongs to the state CRG is about to report.
    const level = this.holdDone(actionId) ? 0 : this.holdLevel(actionId);

    return connectionToggleKey(this.context.client.status, level);
  }

  protected override completeHold(_action: KeyAction): Promise<void> {
    return this.context.client.status === 'stopped'
      ? this.context.connection.connect()
      : this.context.connection.disconnect();
  }
}
