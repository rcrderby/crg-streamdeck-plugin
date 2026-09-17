/**
 * The plugin's global settings, and everything reading or writing them decides.
 *
 * These are the rules a restart depends on: which scoreboard to open,
 * whether the deck was disconnected on purpose, and which session
 * belongs to which scoreboard. They take the store they work through, so
 * a test can hand them a plain object where plugin.ts hands them Stream
 * Deck's own settings.
 */

import type { JsonObject } from '@elgato/utils';

import { SettingsError, resolveConnection, type Connection, type ConnectionSettings } from './crg/settings.ts';

/** Everything the plugin keeps for the whole deck rather than for one key. */
export type GlobalSettings = ConnectionSettings & {
  /** The CRG cookies this device is known by, kept so it stays one device. */
  session?: string;
  /** The scoreboard that issued the session, so it is never offered to another. */
  sessionOrigin?: string;
  /** True once the deck is disconnected on purpose, until it is connected again. */
  stopped?: boolean;
  /** The CRG operator profile the deck keeps its settings under. */
  operator?: string;
  /** The profiles CRG holds, kept here because a property inspector cannot read CRG itself. */
  operators?: string[];
};

/** The part of Stream Deck's settings this works through. */
export type SettingsStore = {
  getGlobalSettings: <T extends JsonObject = JsonObject>() => Promise<T>;
  setGlobalSettings: <T extends JsonObject = JsonObject>(settings: T) => Promise<void>;
};

/** The part of the CRG client these settings drive. */
export type Scoreboard = {
  readonly session: string | undefined;
  readonly origin: string | undefined;
  connect: (connection: Connection, session?: string) => void;
  stop: () => Promise<void>;
};

/** The part of the operator choice these settings drive. */
export type Operator = {
  set: (name: string | undefined) => void;
};

export type PluginSettingsParts = {
  readonly store: SettingsStore;
  readonly client: Scoreboard;
  readonly operator: Operator;
  /** Says why settings could not be used, without stopping the plugin. */
  readonly warn: (message: string) => void;
};

export class PluginSettings {
  readonly #parts: PluginSettingsParts;

  /** The write in progress, which the next one waits on. */
  #writing: Promise<void> = Promise.resolve();

  constructor(parts: PluginSettingsParts) {
    this.#parts = parts;
  }

  /** Opens or re-points the CRG connection from the stored settings, unless the deck was disconnected on purpose. */
  apply(settings: GlobalSettings): void {
    const { client, operator, warn } = this.#parts;

    operator.set(settings.operator);

    if (settings.stopped === true) {
      void client.stop();

      return;
    }

    try {
      const connection = resolveConnection(settings);

      client.connect(connection, sessionFor(settings, connection.origin));
    } catch (cause) {
      if (cause instanceof SettingsError) {
        warn(`The CRG URL is not usable: ${cause.message}`);

        return;
      }

      throw cause;
    }
  }

  /**
   * Stores the session CRG issued, against the scoreboard that issued it.
   *
   * The cookies identify this device to CRG, so they are written to
   * settings and never to the log.
   */
  async rememberSession(): Promise<void> {
    const { client } = this.#parts;
    const session = client.session;
    const sessionOrigin = client.origin;

    if (session === undefined || sessionOrigin === undefined) {
      return;
    }

    await this.#update((settings) =>
      settings.session !== session || settings.sessionOrigin !== sessionOrigin
        ? { ...settings, session, sessionOrigin }
        : undefined
    );
  }

  /**
   * Keeps the operator profiles CRG holds where a property inspector can read them.
   *
   * A property inspector sees only the plugin's settings, never CRG, so
   * the list is copied into them whenever it changes.
   */
  async rememberOperators(names: readonly string[]): Promise<void> {
    if (names.length === 0) {
      return;
    }

    await this.#update((settings) =>
      same(settings.operators ?? [], names) ? undefined : { ...settings, operators: [...names] }
    );
  }

  /**
   * Connects or disconnects on purpose, and remembers the choice.
   *
   * A deck disconnected on purpose stays disconnected across restarts
   * until someone connects it again.
   */
  async setStopped(stopped: boolean): Promise<void> {
    let next: GlobalSettings = {};

    await this.#update((settings) => {
      next = { ...settings, stopped };

      return next;
    });
    this.apply(next);
  }

  /**
   * Reads the settings, changes them, and writes them back, one change at a time.
   *
   * Every change rewrites the whole settings object, so two made at once
   * would each start from the same copy and the later would erase the
   * earlier. A change that returns nothing writes nothing. A failed write
   * is reported to its caller and does not hold up the next.
   */
  #update(change: (settings: GlobalSettings) => GlobalSettings | undefined): Promise<void> {
    const store = this.#parts.store;
    const run = this.#writing.then(async () => {
      const next = change(await store.getGlobalSettings<GlobalSettings>());

      if (next !== undefined) {
        await store.setGlobalSettings(next);
      }
    });

    this.#writing = run.catch(() => undefined);

    return run;
  }
}

/**
 * The stored session, but only for the scoreboard that issued it.
 *
 * Pointing the deck at a different scoreboard would otherwise send the
 * first one's session to the second, in the page request and again on
 * the socket, handing it the identity the deck writes with.
 */
export function sessionFor(settings: GlobalSettings, origin: string): string | undefined {
  return settings.sessionOrigin === origin ? settings.session : undefined;
}

function same(held: readonly string[], names: readonly string[]): boolean {
  return held.length === names.length && held.every((name, index) => name === names[index]);
}
