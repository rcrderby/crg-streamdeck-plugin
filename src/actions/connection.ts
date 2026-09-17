/**
 * Shows whether the plugin is talking to CRG, and opens the connection page.
 *
 * A key that has quietly stopped updating looks the same as a key whose
 * value has not changed, so the state of the connection is shown on a
 * key of its own rather than only implied by the others.
 */

import { type KeyDownEvent, type SendToPluginEvent } from '@elgato/streamdeck';
import type { JsonObject, JsonValue } from '@elgato/utils';

import { type KeySpec } from '../render/key.ts';
import { answerOperatorMessage } from './operator-messages.ts';
import { connectionKey } from '../render/designs.ts';
import { type PluginContext } from '../context.ts';
import { CrgKeyAction } from './key-action.ts';
import { openPage } from './navigation.ts';

export class Connection extends CrgKeyAction {
  constructor(context: PluginContext) {
    super(context);

    context.operator.onChange(() => this.redrawAll());
  }

  protected override watchedPaths(): readonly string[] {
    return [];
  }

  /** Stays readable while disconnected, since this is the key that says what is wrong. */
  protected override get subduedWhileOffline(): boolean {
    return false;
  }

  protected override describe(): KeySpec {
    return connectionKey(this.context.client.status, this.context.operator.name);
  }

  /** Lists the CRG operator profiles for the settings dropdown, and makes one when asked. */
  override onSendToPlugin(event: SendToPluginEvent<JsonValue, JsonObject>): Promise<void> {
    return answerOperatorMessage(this.context, event);
  }

  /**
   * Pressing the key opens the connection page.
   *
   * On a model with no page, it reconnects instead, or connects a deck
   * disconnected on purpose.
   */
  override async onKeyDown(event: KeyDownEvent): Promise<void> {
    if (await openPage(event.action, 'connection')) {
      return;
    }

    if (this.context.client.status === 'stopped') {
      await this.context.connection.connect();
    } else {
      this.context.client.reconnect();
    }
  }
}
