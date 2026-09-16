/**
 * What every CRG key has in common.
 *
 * A subclass names the paths it draws from and describes the key it
 * wants; this class subscribes once for the whole action, paces the
 * redraws, and skips the ones that would not change the picture. It
 * subdues every key while CRG is disconnected, and keeps redrawing a
 * key while it animates.
 *
 * Nothing here knows a key index, a grid size, or a device model. Where
 * a key sits belongs to a Stream Deck profile, not to this code.
 */

import { SingletonAction, type KeyAction, type WillAppearEvent, type WillDisappearEvent } from '@elgato/streamdeck';
import type { DidReceiveSettingsEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { type ConnectionStatus } from '../crg/client.ts';
import { type KeySpec, renderKey } from '../render/key.ts';
import { type PluginContext } from '../context.ts';

/** True while the plugin can read the game; a connection refused a write still can. */
export function isOnline(status: ConnectionStatus): boolean {
  return status === 'connected' || status === 'unauthorized';
}

export abstract class CrgKeyAction<T extends JsonObject = JsonObject> extends SingletonAction<T> {
  protected readonly context: PluginContext;

  readonly #settings = new Map<string, T>();
  readonly #drawn = new Map<string, string>();

  constructor(context: PluginContext) {
    super();

    this.context = context;

    context.client.state.subscribe(this.watchedPaths(), () => this.redrawAll());
    context.client.on('status', () => this.redrawAll());
  }

  /** The CRG paths whose changes this action draws. */
  protected abstract watchedPaths(): readonly string[];

  /** Describes one key for the state the plugin currently holds. */
  protected abstract describe(settings: T, actionId: string): KeySpec;

  /** False for keys that have to stay readable while CRG is disconnected. */
  protected get subduedWhileOffline(): boolean {
    return true;
  }

  /** True while a key is moving, so it redraws on every tick rather than only when something changes. */
  protected animates(_actionId: string, _settings: T): boolean {
    return false;
  }

  override onWillAppear(event: WillAppearEvent<T>): void {
    this.#settings.set(event.action.id, event.payload.settings);
    this.redraw(event.action);
  }

  override onWillDisappear(event: WillDisappearEvent<T>): void {
    this.#settings.delete(event.action.id);
    this.#drawn.delete(event.action.id);
  }

  override onDidReceiveSettings(event: DidReceiveSettingsEvent<T>): void {
    this.#settings.set(event.action.id, event.payload.settings);
    this.redraw(event.action);
  }

  /** The settings one visible key last reported. */
  protected settingsOf(actionId: string): T | undefined {
    return this.#settings.get(actionId);
  }

  /** Queues a redraw of every visible key this action owns. */
  protected redrawAll(): void {
    for (const action of this.actions) {
      this.redraw(action);
    }
  }

  /** Queues a redraw of one key. */
  protected redraw(action: { id: string } & Partial<KeyAction<T>>): void {
    this.context.scheduler.request(action.id, () => {
      if (typeof action.setImage !== 'function' || !this.#settings.has(action.id)) {
        return;
      }

      const settings = this.#settings.get(action.id) ?? ({} as T);
      const spec = this.describe(settings, action.id);
      const offline = this.subduedWhileOffline && !isOnline(this.context.client.status);
      const image = renderKey(offline ? { ...spec, subdued: true } : spec);

      if (this.animates(action.id, settings)) {
        this.redraw(action);
      }

      if (this.#drawn.get(action.id) === image) {
        return;
      }

      this.#drawn.set(action.id, image);
      void action.setImage(image);
    });
  }
}
