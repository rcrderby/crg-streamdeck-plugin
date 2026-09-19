/**
 * A Stream Deck that is not there, for driving key actions in a test.
 *
 * An action talks to three things: the CRG client, the scheduler, and
 * the keys Stream Deck tells it about. All three are stood in for here,
 * so a key press, a hold, and a redraw can be run and read back without
 * hardware and without a scoreboard.
 */

import streamDeck, { type KeyAction, type SingletonAction } from '@elgato/streamdeck';
import type { JsonObject } from '@elgato/utils';

import { CrgClient, type ConnectionStatus, type SetFlag } from '../crg/client.ts';
import { OperatorChoice } from '../operator-choice.ts';
import { PeriodEndSeconds } from '../period-end-seconds.ts';
import { RenderScheduler } from '../render/scheduler.ts';
import { type StateValue } from '../crg/state.ts';
import { type PluginContext } from '../context.ts';

/** One write an action asked CRG for. */
export type Written = { key: string; value: StateValue; flag: SetFlag };

/** One profile switch an action asked Stream Deck for. A page closing carries no profile. */
export type Switched = { deviceId: string; profile: string | undefined };

/** The Stream Deck XL, whose device type the shipped page profiles are keyed by. */
export const XL = 2;

/** A model with no page profile, so a key that would open a page has nowhere to go. */
export const PEDAL = 5;

/**
 * A CRG client that holds state and records writes, without a socket.
 *
 * Its state store is the real one, so an action reads what CRG would
 * send it rather than a stand-in.
 */
export class OfflineScoreboard extends CrgClient {
  readonly written: Written[] = [];

  #reported: ConnectionStatus = 'connected';

  override get status(): ConnectionStatus {
    return this.#reported;
  }

  /** Reports a connection state, telling the keys as a real change would. */
  say(status: ConnectionStatus): void {
    this.#reported = status;
    this.emit('status', status);
  }

  /** Records a write, and drops it with no socket open, as the real client does. */
  override set(key: string, value: StateValue, flag: SetFlag = ''): void {
    if (this.#reported === 'connected' || this.#reported === 'unauthorized') {
      this.written.push({ key, value, flag });
    }
  }
}

/** One key on the fake deck, holding what the action drew and saved on it. */
export class FakeKey<T extends JsonObject = JsonObject> {
  readonly images: string[] = [];
  readonly saved: T[] = [];

  alerts = 0;

  readonly id: string;
  readonly device: { id: string; type: number };

  constructor(id: string, device: { id: string; type: number }) {
    this.id = id;
    this.device = device;
  }

  /** The picture last drawn on this key. */
  get image(): string | undefined {
    return this.images.at(-1);
  }

  setImage(image: string): Promise<void> {
    this.images.push(image);

    return Promise.resolve();
  }

  setSettings(settings: T): Promise<void> {
    this.saved.push(settings);

    return Promise.resolve();
  }

  showAlert(): Promise<void> {
    this.alerts += 1;

    return Promise.resolve();
  }
}

/** A deck holding one CRG client, one scheduler, and the keys a test places on it. */
export class FakeDeck {
  readonly client = new OfflineScoreboard();
  readonly scheduler = new RenderScheduler();
  readonly operator = new OperatorChoice();
  readonly periodEndSeconds = new PeriodEndSeconds();
  readonly switched: Switched[] = [];
  readonly connection = {
    connect: (): Promise<void> => Promise.resolve(),
    disconnect: (): Promise<void> => Promise.resolve()
  };

  #keys = 0;

  constructor() {
    Object.defineProperty(streamDeck, 'profiles', {
      configurable: true,
      value: {
        switchToProfile: (deviceId: string, profile?: string): Promise<void> => {
          this.switched.push({ deviceId, profile });

          return Promise.resolve();
        }
      }
    });
  }

  get context(): PluginContext {
    return {
      client: this.client,
      scheduler: this.scheduler,
      connection: this.connection,
      operator: this.operator,
      periodEndSeconds: this.periodEndSeconds
    };
  }

  /** What CRG holds, written straight into the store as a delta would. */
  hold(values: Readonly<Record<string, StateValue>>): void {
    this.client.state.apply(values);
  }

  /** The writes an action asked CRG for. */
  get written(): Written[] {
    return this.client.written;
  }

  /** Places a key on the deck and tells the action it appeared. */
  place<T extends JsonObject>(keyAction: SingletonAction<T>, settings: T = {} as T, deviceType = XL): FakeKey<T> {
    this.#keys += 1;

    const key = new FakeKey<T>(`key-${this.#keys}`, { id: 'device-1', type: deviceType });

    keyAction.onWillAppear?.(event(key, settings));
    this.scheduler.flush();

    return key;
  }

  /** Takes a key off the deck, as changing profile does. */
  remove<T extends JsonObject>(keyAction: SingletonAction<T>, key: FakeKey<T>): void {
    keyAction.onWillDisappear?.(event(key, {} as T));
  }

  /** Tells the action a key's settings changed, as the property inspector does. */
  resettle<T extends JsonObject>(keyAction: SingletonAction<T>, key: FakeKey<T>, settings: T): void {
    keyAction.onDidReceiveSettings?.(event(key, settings));
    this.scheduler.flush();
  }

  /** Presses a key and lets go, which is what a press is. */
  async press<T extends JsonObject>(
    keyAction: SingletonAction<T>,
    key: FakeKey<T>,
    settings: T = {} as T
  ): Promise<void> {
    await keyAction.onKeyDown?.(event(key, settings));
    await keyAction.onKeyUp?.(event(key, settings));
    this.scheduler.flush();
  }

  /** Presses a key and keeps holding it. */
  async holdDown<T extends JsonObject>(
    keyAction: SingletonAction<T>,
    key: FakeKey<T>,
    settings: T = {} as T
  ): Promise<void> {
    await keyAction.onKeyDown?.(event(key, settings));
    this.scheduler.flush();
  }

  /** Lets go of a key. */
  async letGo<T extends JsonObject>(
    keyAction: SingletonAction<T>,
    key: FakeKey<T>,
    settings: T = {} as T
  ): Promise<void> {
    await keyAction.onKeyUp?.(event(key, settings));
    this.scheduler.flush();
  }

  /** Runs every queued redraw now, rather than waiting out the scheduler's tick. */
  draw(): void {
    this.scheduler.flush();
  }

  /** Stops the scheduler, so nothing is left ticking when a test ends. */
  stop(): void {
    this.scheduler.clear();
  }
}

/** The shape of a Stream Deck event, as much of it as an action reads. */
function event<T extends JsonObject>(key: FakeKey<T>, settings: T): never {
  return { action: key, payload: { settings } } as unknown as never;
}

/** The type a fake key stands in for, which the actions treat as a real one. */
export type AsKeyAction<T extends JsonObject> = FakeKey<T> & KeyAction<T>;
