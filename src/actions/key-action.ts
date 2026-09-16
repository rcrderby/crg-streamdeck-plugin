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

/**
 * Names an action as its entry in the manifest, which is what registering it reads.
 *
 * The SDK offers a class decorator for this, which sets the same field on
 * a subclass. It is done by hand because Node runs the TypeScript in src/
 * by stripping its types, and a decorator is not a type: a file carrying
 * one cannot be loaded by the test runner at all, which is what left this
 * whole layer without a test.
 */
export function named<T extends SingletonAction<never>>(uuid: string, keyAction: T): T {
  Object.defineProperty(keyAction, 'manifestId', { value: uuid, writable: false, enumerable: true });

  return keyAction;
}

export abstract class CrgKeyAction<T extends JsonObject = JsonObject> extends SingletonAction<T> {
  protected readonly context: PluginContext;

  readonly #settings = new Map<string, T>();
  readonly #drawn = new Map<string, string>();
  readonly #visible = new Map<string, WillAppearEvent<T>['action']>();

  constructor(context: PluginContext) {
    super();

    this.context = context;

    context.client.state.subscribe(this.watchedPaths(), (changed) => this.redrawAll(changed));
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

  /**
   * Whether one key's picture depends on any of the paths that changed.
   *
   * An action names the paths every key of its kind can draw from, since
   * it subscribes before any key has settings. A key whose settings
   * narrow that, such as a clock key showing one of the five clocks,
   * says so here rather than drawing itself again for a change it is not
   * showing.
   */
  protected concerns(_settings: T | undefined, _changed: ReadonlySet<string>): boolean {
    return true;
  }

  override onWillAppear(event: WillAppearEvent<T>): void {
    this.#settings.set(event.action.id, event.payload.settings);
    this.#visible.set(event.action.id, event.action);
    this.redraw(event.action);
  }

  override onWillDisappear(event: WillDisappearEvent<T>): void {
    this.#settings.delete(event.action.id);
    this.#drawn.delete(event.action.id);
    this.#visible.delete(event.action.id);
  }

  override onDidReceiveSettings(event: DidReceiveSettingsEvent<T>): void {
    this.#settings.set(event.action.id, event.payload.settings);
    this.redraw(event.action);
  }

  /** The settings one visible key last reported. */
  protected settingsOf(actionId: string): T | undefined {
    return this.#settings.get(actionId);
  }

  /**
   * The keys of this action currently on a deck.
   *
   * These are the keys that have appeared and not yet gone, which the
   * action knows because Stream Deck tells it both. Reading them here
   * rather than from the SDK's own store lets the whole layer be driven
   * without a deck.
   */
  protected get visibleKeys(): WillAppearEvent<T>['action'][] {
    return [...this.#visible.values()];
  }

  /** Queues a redraw of every visible key this action owns, skipping any the change does not reach. */
  protected redrawAll(changed?: ReadonlySet<string>): void {
    for (const action of this.#visible.values()) {
      if (changed !== undefined && !this.concerns(this.#settings.get(action.id), changed)) {
        continue;
      }

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
