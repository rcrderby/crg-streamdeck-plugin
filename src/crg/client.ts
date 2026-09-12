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

import { REGISTERED_PATHS } from './paths.ts';
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

const SESSION_COOKIE = 'JSESSIONID';

/** Reads the session cookie out of a response, ignoring its attributes. */
export function readSessionCookie(setCookie: readonly string[]): string | undefined {
  for (const header of setCookie) {
    const match = /(?:^|;\s*)JSESSIONID=([^;]+)/i.exec(header);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

export class CrgClient extends EventEmitter<CrgClientEvents> {
  readonly state = new StateStore();

  #connection: Connection | undefined;
  #socket: WebSocket | undefined;
  #sessionId: string | undefined;
  #ping: NodeJS.Timeout | undefined;
  #reconnect: NodeJS.Timeout | undefined;
  #reconnectDelayMs = RECONNECT_MIN_MS;
  #status: ConnectionStatus = 'disconnected';
  #closing = false;

  get status(): ConnectionStatus {
    return this.#status;
  }

  /** The session this device is known by, to be stored between runs. */
  get sessionId(): string | undefined {
    return this.#sessionId;
  }

  /**
   * Points the client at a scoreboard and connects.
   *
   * Calling this again with a different address reconnects to it.
   */
  connect(connection: Connection, sessionId?: string): void {
    const changed = this.#connection?.webSocketUrl !== connection.webSocketUrl;

    this.#connection = connection;
    this.#closing = false;

    if (sessionId) {
      this.#sessionId = sessionId;
    }

    if (changed) {
      this.state.clear();
    }

    if (changed || this.#socket === undefined) {
      this.#open();
    }
  }

  /** Closes the connection and stops reconnecting. */
  disconnect(): void {
    this.#closing = true;
    this.#clearTimers();
    this.#socket?.close();
    this.#socket = undefined;
    this.#setStatus('disconnected');
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
    this.#socket?.removeAllListeners();
    this.#socket?.close();
    this.#socket = undefined;

    const connection = this.#connection;

    if (connection === undefined) {
      return;
    }

    this.#setStatus('connecting');

    void this.#fetchSession(connection)
      .then(() => this.#openSocket(connection))
      .catch((cause: unknown) => {
        this.emit('error', cause instanceof Error ? cause : new Error(String(cause)));
        this.#scheduleReconnect();
      });
  }

  /**
   * Asks CRG for a session, so the socket connects as a known device.
   *
   * A scoreboard that does not hand one back still works; the device is
   * then new on every connection.
   */
  async #fetchSession(connection: Connection): Promise<void> {
    const headers: Record<string, string> = {};

    if (this.#sessionId) {
      headers['Cookie'] = `${SESSION_COOKIE}=${this.#sessionId}`;
    }

    const response = await fetch(`${connection.origin}/`, { headers, redirect: 'manual' });
    const issued = readSessionCookie(response.headers.getSetCookie());

    if (issued) {
      this.#sessionId = issued;
    }
  }

  #openSocket(connection: Connection): void {
    const headers: Record<string, string> = {};

    if (this.#sessionId) {
      headers['Cookie'] = `${SESSION_COOKIE}=${this.#sessionId}`;
    }

    const socket = new WebSocket(connection.webSocketUrl, { headers });

    this.#socket = socket;

    socket.on('open', () => {
      this.#reconnectDelayMs = RECONNECT_MIN_MS;
      this.#setStatus('connected');
      this.#send({ action: 'Register', paths: [...REGISTERED_PATHS] });
      this.#ping = setInterval(() => this.#send({ action: 'Ping' }), PING_INTERVAL_MS);
    });

    socket.on('message', (data: RawData) => this.#receive(data));
    socket.on('error', (cause: Error) => this.emit('error', cause));
    socket.on('close', () => {
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
