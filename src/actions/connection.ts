/**
 * Shows whether the plugin is talking to CRG.
 *
 * A key that has quietly stopped updating looks the same as a key whose
 * value has not changed, so the state of the connection is shown on a
 * key of its own rather than only implied by the others.
 */

import { action, type KeyDownEvent } from '@elgato/streamdeck';

import { type ConnectionStatus } from '../crg/client.ts';
import { type KeySpec } from '../render/key.ts';
import { CrgKeyAction } from './key-action.ts';

type Appearance = {
  readonly background: string;
  readonly accent: string;
  readonly headline: string;
  readonly detail: string;
};

const APPEARANCE: Readonly<Record<ConnectionStatus, Appearance>> = {
  connected: {
    background: '#04170c',
    accent: '#22c55e',
    headline: 'CRG',
    detail: 'Connected'
  },
  connecting: {
    background: '#1c1503',
    accent: '#eab308',
    headline: 'CRG',
    detail: 'Connecting'
  },
  disconnected: {
    background: '#1f0708',
    accent: '#ef4444',
    headline: 'NO CRG',
    detail: 'Offline'
  },
  unauthorized: {
    background: '#1f0708',
    accent: '#f97316',
    headline: 'NO CRG',
    detail: 'Not allowed'
  }
};

@action({ UUID: 'com.rcrderby.crg-streamdeck.connection' })
export class Connection extends CrgKeyAction {
  protected override watchedPaths(): readonly string[] {
    return [];
  }

  protected override describe(): KeySpec {
    const appearance = APPEARANCE[this.context.client.status];

    return {
      background: appearance.background,
      foreground: '#ffffff',
      accent: appearance.accent,
      texts: [
        { text: appearance.headline, y: 44, size: 20, weight: 'bold' },
        { text: appearance.detail, y: 72, size: 13, opacity: 0.85 }
      ]
    };
  }

  /** Pressing the key reconnects, so a stalled bout is one press from recovery. */
  override onKeyDown(event: KeyDownEvent): void | Promise<void> {
    this.context.client.reconnect();

    return event.action.showOk();
  }
}
