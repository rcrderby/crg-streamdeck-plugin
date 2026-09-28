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
import { type SessionStore, type StoredSession } from './session-file.ts';
import { type StoppedStore } from './connection-file.ts';
import { messageOf } from './errors.ts';

/**
 * Everything the plugin keeps for the whole deck rather than for one key.
 *
 * A property inspector is handed these settings whole and writes them
 * back whole, so the CRG session and whether the deck was disconnected
 * on purpose live in files of the plugin's own instead.
 */
export type GlobalSettings = ConnectionSettings & {
  /** The CRG operator profile the deck keeps its settings under. */
  operator?: string;
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
  readonly session: SessionStore;
  /** Whether the deck was disconnected on purpose. */
  readonly stopped: StoppedStore;
  readonly client: Scoreboard;
  readonly operator: Operator;
  /** Says why settings could not be used, without stopping the plugin. */
  readonly warn: (message: string) => void;
};

export class PluginSettings {
  readonly #parts: PluginSettingsParts;

  /** The stored session, read once at startup so a connection need not wait on the file. */
  #stored: StoredSession | undefined;

  /** True while the deck is disconnected on purpose, read once at startup. */
  #stopped = false;

  /** The settings last applied, which connecting on purpose applies again. */
  #settings: GlobalSettings = {};

  /** The write in progress, which the next one waits on. */
  #writing: Promise<void> = Promise.resolve();

  constructor(parts: PluginSettingsParts) {
    this.#parts = parts;
  }

  /**
   * Reads what the plugin keeps in its own files: the stored session, so
   * the first connection offers CRG the identity the deck already has,
   * and whether the deck was disconnected on purpose.
   */
  async load(): Promise<void> {
    const { session, stopped, warn } = this.#parts;

    try {
      this.#stored = await session.read();
    } catch (cause) {
      warn(`Could not read the stored CRG session: ${messageOf(cause)}`);
    }

    try {
      this.#stopped = await stopped.read();
    } catch (cause) {
      warn(`Could not read whether the deck was disconnected on purpose: ${messageOf(cause)}`);
    }
  }

  /** Opens or re-points the CRG connection from the stored settings, unless the deck was disconnected on purpose. */
  apply(settings: GlobalSettings): void {
    const { client, operator, warn } = this.#parts;

    this.#settings = settings;
    operator.set(settings.operator);

    if (this.#stopped) {
      void client.stop();

      return;
    }

    try {
      const connection = resolveConnection(settings);

      client.connect(connection, sessionFor(this.#stored, connection.origin));
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
   * The cookies identify this device to CRG, so they go to the session
   * file, never to the settings a property inspector reads and never to
   * the log.
   */
  async rememberSession(): Promise<void> {
    const { client, session, warn } = this.#parts;
    const held = client.session;
    const origin = client.origin;

    if (held === undefined || origin === undefined) {
      return;
    }

    if (this.#stored?.session === held && this.#stored.origin === origin) {
      return;
    }

    try {
      await session.write({ session: held, origin });
      this.#stored = { session: held, origin };
    } catch (cause) {
      warn(`Could not store the CRG session: ${messageOf(cause)}`);
    }
  }

  /**
   * Operator selection; remembered for a session restart.
   *
   * The choice is used at once, and stored so a restart keeps it.
   */
  async chooseOperator(name: string): Promise<void> {
    this.#parts.operator.set(name);

    await this.#update((settings) => (settings.operator === name ? undefined : { ...settings, operator: name }));
  }

  /**
   * Connects or disconnects on purpose, and remembers the choice.
   *
   * The choice takes effect at once. A deck disconnected on purpose stays
   * disconnected across restarts until someone connects it again; if the
   * choice cannot be saved, it lasts until the plugin restarts, and the
   * log says so.
   */
  async setStopped(stopped: boolean): Promise<void> {
    const { warn } = this.#parts;

    this.#stopped = stopped;
    this.apply(this.#settings);

    try {
      await this.#parts.stopped.write(stopped);
    } catch (cause) {
      warn(`Could not remember that the deck was ${stopped ? 'disconnected' : 'connected'}: ${messageOf(cause)}`);
    }
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
export function sessionFor(stored: StoredSession | undefined, origin: string): string | undefined {
  return stored?.origin === origin ? stored.session : undefined;
}
