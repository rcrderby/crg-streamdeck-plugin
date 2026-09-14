/**
 * The plugin's one connection to CRG.
 *
 * Every action reads the same StateStore and writes through the same
 * socket, so a full deck of keys costs CRG a single client.
 *
 * CRG identifies a device by its HTTP session, so the client fetches a
 * session cookie before opening the socket and keeps using it. A device
 * that changes identity on every reconnect has to be re-authorized in
 * CRG each time, and fills its client list with ghosts.
 */

import { EventEmitter } from 'node:events';
import { WebSocket, type RawData } from 'ws';

import { DEVICE_NAME, REGISTERED_PATHS } from './paths.ts';
import { type Connection } from './settings.ts';
import { StateStore, type StateValue } from './state.ts';

/** How a Set is applied. A relative change carries 'change'. */
export type SetFlag = '' | 'change' | 'reset';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unauthorized';

export type CrgClientEvents = {
  status: [ConnectionStatus];
  /** CRG refused a write because this device may not write. */
  unauthorized: [string];
  error: [Error];
};

const PING_INTERVAL_MS = 30_000;

const RECONNECT_MIN_MS = 1_000;

const RECONNECT_MAX_MS = 30_000;

/** Names that carry a cookie's attributes rather than its value. */
const COOKIE_ATTRIBUTES = new Set([
  'domain',
  'expires',
  'httponly',
  'max-age',
  'partitioned',
  'path',
  'priority',
  'samesite',
  'secure'
]);

/**
 * Reads the cookies a response sets, dropping their attributes.
 *
 * CRG 2027 names its session cookie 'CRG_SCOREBOARD' and earlier
 * builds used the servlet container's own name, so whatever it sets is
 * kept rather than one name being looked for.
 */
export function readSessionCookies(setCookie: readonly string[]): string | undefined {
  const pairs = setCookie
    .map((header) => header.split(';')[0]?.trim() ?? '')
    .filter((pair) => {
      const name = pair.split('=')[0]?.trim().toLowerCase() ?? '';

      return name !== '' && pair.includes('=') && !COOKIE_ATTRIBUTES.has(name);
    });

  return pairs.length > 0 ? pairs.join('; ') : undefined;
}

/** An error's message, or its code when the message is empty. */
function errorText(error: Error): string {
  if (error.message !== '') {
    return error.message;
  }

  return (error as NodeJS.ErrnoException).code ?? error.name;
}

/**
 * Describes a connection error in one line, without a stack trace.
 *
 * A failed fetch says only 'fetch failed' and keeps the reason in its
 * cause, so the cause is included.
 */
export function describeError(error: Error): string {
  return error.cause instanceof Error ? `${errorText(error)}: ${errorText(error.cause)}` : errorText(error);
}

export class CrgClient extends EventEmitter<CrgClientEvents> {
  readonly state = new StateStore();

  #connection: Connection | undefined;
  #socket: WebSocket | undefined;
  #session: string | undefined;
  #ping: NodeJS.Timeout | undefined;
  #reconnect: NodeJS.Timeout | undefined;
  #reconnectDelayMs = RECONNECT_MIN_MS;
  #status: ConnectionStatus = 'disconnected';
  #closing = false;
  /** Counts connection attempts, so a superseded attempt can tell. */
  #attempt = 0;
  /** True while a session is being fetched and no socket exists yet. */
  #opening = false;

  get status(): ConnectionStatus {
    return this.#status;
  }

  /**
   * The cookies this device is known by, to be stored between runs.
   *
   * This identifies the device to CRG, so it is never logged.
   */
  get session(): string | undefined {
    return this.#session;
  }

  /** The name CRG shows this device under in its client list. */
  get deviceName(): string | undefined {
    const name = this.state.getString(DEVICE_NAME);

    return name === '' ? undefined : name;
  }

  /**
   * Points the client at a scoreboard and connects.
   *
   * Calling this again with a different address reconnects to it. With
   * the same address it does nothing while a connection is open or
   * being opened.
   */
  connect(connection: Connection, session?: string): void {
    const changed = this.#connection?.webSocketUrl !== connection.webSocketUrl;

    this.#connection = connection;
    this.#closing = false;

    if (session) {
      this.#session = session;
    }

    if (changed) {
      this.state.clear();
    }

    if (changed || (this.#socket === undefined && !this.#opening)) {
      this.#open();
    }
  }

  /**
   * Reconnects now, without waiting out the backoff delay.
   *
   * The status key offers this so a stalled connection is one press
   * from recovery in the middle of a game.
   */
  reconnect(): void {
    if (this.#connection === undefined) {
      return;
    }

    this.#closing = false;
    this.#reconnectDelayMs = RECONNECT_MIN_MS;
    this.#open();
  }

  /**
   * Closes the connection and stops reconnecting.
   *
   * Resolves once the socket has closed, so a plugin that is stopping
   * can wait for CRG to hear it leave.
   */
  disconnect(): Promise<void> {
    this.#closing = true;
    this.#clearTimers();

    const closed = this.#retire();

    this.#setStatus('disconnected');

    return closed;
  }

  /**
   * Writes a value to a CRG path.
   *
   * A relative change uses the 'change' flag, which is how CRG's own
   * pages add or subtract from a score or a clock.
   */
  set(key: string, value: StateValue, flag: SetFlag = ''): void {
    this.#send({ action: 'Set', key, value, flag });
  }

  /** Sets a path to true, which is how CRG triggers an action. */
  trigger(key: string): void {
    this.set(key, true);
  }

  #open(): void {
    this.#clearTimers();
    void this.#retire();

    const connection = this.#connection;

    if (connection === undefined) {
      return;
    }

    const attempt = this.#attempt;

    this.#opening = true;
    this.#setStatus('connecting');

    void this.#fetchSession(connection)
      .then(() => {
        if (attempt === this.#attempt) {
          this.#opening = false;
          this.#openSocket(connection);
        }
      })
      .catch((cause: unknown) => {
        if (attempt !== this.#attempt) {
          return;
        }

        this.#opening = false;
        this.emit('error', cause instanceof Error ? cause : new Error(String(cause)));
        this.#scheduleReconnect();
      });
  }

  /**
   * Stops using the current socket and supersedes any attempt in flight.
   *
   * A retired socket keeps its listeners, which ignore it, because the
   * socket library reports an error when a handshake is abandoned.
   */
  #retire(): Promise<void> {
    this.#attempt += 1;
    this.#opening = false;

    const socket = this.#socket;

    this.#socket = undefined;

    if (socket === undefined || socket.readyState === WebSocket.CLOSED) {
      return Promise.resolve();
    }

    const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));

    socket.close();

    return closed;
  }

  /**
   * Asks CRG for a session, so the socket connects as a known device.
   *
   * A scoreboard that does not hand one back still works; the device is
   * then new on every connection.
   */
  async #fetchSession(connection: Connection): Promise<void> {
    const headers: Record<string, string> = {};

    if (this.#session) {
      headers['Cookie'] = this.#session;
    }

    const response = await fetch(`${connection.origin}/`, { headers, redirect: 'manual' });
    const issued = readSessionCookies(response.headers.getSetCookie());

    if (issued) {
      this.#session = issued;
    }
  }

  /** Opens the socket. Its events are acted on only while it is current. */
  #openSocket(connection: Connection): void {
    const headers: Record<string, string> = {};

    if (this.#session) {
      headers['Cookie'] = this.#session;
    }

    const socket = new WebSocket(connection.webSocketUrl, { headers });
    const current = (): boolean => this.#socket === socket;

    this.#socket = socket;

    socket.on('open', () => {
      if (!current()) {
        return;
      }

      this.#reconnectDelayMs = RECONNECT_MIN_MS;
      this.#setStatus('connected');
      this.#send({ action: 'Register', paths: [...REGISTERED_PATHS] });
      this.#ping = setInterval(() => this.#send({ action: 'Ping' }), PING_INTERVAL_MS);
    });

    socket.on('message', (data: RawData) => {
      if (current()) {
        this.#receive(data);
      }
    });

    socket.on('error', (cause: Error) => {
      if (current()) {
        this.emit('error', cause);
      }
    });

    socket.on('close', () => {
      if (!current()) {
        return;
      }

      this.#clearTimers();
      this.#socket = undefined;

      if (!this.#closing) {
        this.#setStatus('disconnected');
        this.#scheduleReconnect();
      }
    });
  }

  #receive(data: RawData): void {
    let message: unknown;

    try {
      message = JSON.parse(data.toString());
    } catch {
      this.emit('error', new Error('CRG sent a message that is not JSON'));

      return;
    }

    if (typeof message !== 'object' || message === null) {
      return;
    }

    const { authorization, state } = message as { authorization?: unknown; state?: unknown };

    if (typeof authorization === 'string') {
      this.#setStatus('unauthorized');
      this.emit('unauthorized', authorization);

      return;
    }

    if (typeof state === 'object' && state !== null) {
      this.state.apply(state as Record<string, StateValue>);
    }
  }

  #send(payload: Record<string, unknown>): void {
    if (this.#socket?.readyState === WebSocket.OPEN) {
      this.#socket.send(JSON.stringify(payload));
    }
  }

  #scheduleReconnect(): void {
    if (this.#closing || this.#reconnect !== undefined) {
      return;
    }

    const delay = this.#reconnectDelayMs;

    this.#reconnectDelayMs = Math.min(delay * 2, RECONNECT_MAX_MS);
    this.#reconnect = setTimeout(() => {
      this.#reconnect = undefined;
      this.#open();
    }, delay);
  }

  #clearTimers(): void {
    if (this.#ping !== undefined) {
      clearInterval(this.#ping);
      this.#ping = undefined;
    }

    if (this.#reconnect !== undefined) {
      clearTimeout(this.#reconnect);
      this.#reconnect = undefined;
    }
  }

  #setStatus(status: ConnectionStatus): void {
    if (this.#status !== status) {
      this.#status = status;
      this.emit('status', status);
    }
  }
}
