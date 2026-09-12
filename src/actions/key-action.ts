/**
 * What every CRG key has in common.
 *
 * A subclass names the paths it draws from and describes the key it
 * wants; this class subscribes once for the whole action, paces the
 * redraws, and skips the ones that would not change the picture.
 *
 * Nothing here knows a key index, a grid size, or a device model. Where
 * a key sits belongs to a Stream Deck profile, not to this code.
 */

import { SingletonAction, type KeyAction, type WillAppearEvent, type WillDisappearEvent } from '@elgato/streamdeck';
import type { DidReceiveSettingsEvent } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { type KeySpec, renderKey } from '../render/key.ts';
import { type PluginContext } from '../context.ts';

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

  /** Describes the key for the state the plugin currently holds. */
  protected abstract describe(settings: T): KeySpec;

  override onWillAppear(event: WillAppearEvent<T>): void {
    this.#settings.set(event.action.id, event.payload.settings);
    this.#draw(event.action);
  }

  override onWillDisappear(event: WillDisappearEvent<T>): void {
    this.#settings.delete(event.action.id);
    this.#drawn.delete(event.action.id);
  }

  override onDidReceiveSettings(event: DidReceiveSettingsEvent<T>): void {
    this.#settings.set(event.action.id, event.payload.settings);
    this.#draw(event.action);
  }

  /** Queues a redraw of every visible key this action owns. */
  protected redrawAll(): void {
    for (const action of this.actions) {
      this.#draw(action);
    }
  }

  #draw(action: { id: string } & Partial<KeyAction<T>>): void {
    this.context.scheduler.request(action.id, () => {
      if (typeof action.setImage !== 'function') {
        return;
      }

      const settings = this.#settings.get(action.id) ?? ({} as T);
      const image = renderKey(this.describe(settings));

      if (this.#drawn.get(action.id) === image) {
        return;
      }

      this.#drawn.set(action.id, image);
      void action.setImage(image);
    });
  }
}
