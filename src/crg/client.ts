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

/** Where the connection stands. 'stopped' is a disconnect made on purpose, as opposed to CRG going away. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'unauthorized' | 'stopped';

export type CrgClientEvents = {
  status: [ConnectionStatus];
  /** CRG refused a write because this device may not write. */
  unauthorized: [string];
  error: [Error];
};

/** How often the client pings CRG, which answers each ping. */
const PING_INTERVAL_MS = 10_000;

/**
 * How long CRG may say nothing before the connection is given up as dead.
 *
 * A connection that drops without closing, as when an access point
 * restarts, otherwise reads as connected while every clock freezes and
 * every press is lost. CRG answers each ping, so a healthy connection
 * is never quiet for longer than one ping interval.
 */
const SILENCE_LIMIT_MS = 25_000;

/**
 * How long CRG is given to finish answering a Register.
 *
 * CRG answers with everything it holds under the registered paths, but
 * nothing says it arrives in one message, so what it sends in this window
 * is taken as the answer. Whatever the deck still holds afterward was
 * deleted while it was away, and goes.
 */
const SNAPSHOT_SETTLE_MS = 1_000;

/** How long the session request and the socket handshake may each take before the attempt is retried. */
const OPEN_TIMEOUT_MS = 10_000;

const RECONNECT_MIN_MS = 1_000;

const RECONNECT_MAX_MS = 30_000;

/**
 * How long a refused write is reported for.
 *
 * CRG says nothing when a device is given permission, so the refusal is
 * shown for a while after the write it answered and raised again by the
 * next write CRG refuses.
 */
export const REFUSAL_SHOWN_MS = 30_000;

/**
 * Room for a listener per key, and a few for the plugin itself.
 *
 * Every action follows the connection, and a deck can hold more keys
 * than Node's own limit warns at, which would put a leak warning in the
 * log for something working as designed.
 */
const MAX_LISTENERS = 100;

/** What a client can be built with, so a test need not wait out the refusal or the silence. */
export type CrgClientOptions = {
  refusalShownMs?: number;
  pingIntervalMs?: number;
  silenceLimitMs?: number;
  snapshotSettleMs?: number;
};

/** Device details CRG sends on its own when a socket opens, ahead of anything registered. */
const DEVICE_PREFIX = 'WS.';

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

/** The names CRG has given its session cookie. */
const SESSION_COOKIE_NAMES = new Set(['crg_scoreboard', 'jsessionid']);

/** True for a cookie name that carries a session rather than something else the scoreboard keeps. */
function isSessionCookie(name: string): boolean {
  return SESSION_COOKIE_NAMES.has(name) || name.includes('session');
}

/**
 * Reads the session a response sets, dropping cookie attributes.
 *
 * CRG 2027 names its session cookie 'CRG_SCOREBOARD' and earlier builds
 * used the servlet container's own name, so a cookie that reads as a
 * session is preferred and everything is kept only when none does. What
 * is kept is written to settings and sent on every connection, so a
 * scoreboard that one day sets a second cookie does not have it stored
 * and replayed for good.
 */
export function readSessionCookies(setCookie: readonly string[]): string | undefined {
  const pairs = setCookie
    .map((header) => header.split(';')[0]?.trim() ?? '')
    .filter((pair) => {
      const name = pair.split('=')[0]?.trim().toLowerCase() ?? '';

      return name !== '' && pair.includes('=') && !COOKIE_ATTRIBUTES.has(name);
    });

  const sessions = pairs.filter((pair) => isSessionCookie(pair.split('=')[0]?.trim().toLowerCase() ?? ''));
  const kept = sessions.length > 0 ? sessions : pairs;

  return kept.length > 0 ? kept.join('; ') : undefined;
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
  /** Runs out the time a refused write is reported for. */
  #refusal: NodeJS.Timeout | undefined;
  readonly #refusalShownMs: number;
  readonly #pingIntervalMs: number;
  readonly #silenceLimitMs: number;
  readonly #snapshotSettleMs: number;
  /** When CRG last sent anything on the current socket. */
  #lastHeard = 0;
  /** The paths CRG has sent since the socket opened, while its answer to Register is still arriving. */
  #snapshotPaths: Set<string> | undefined;

  /** Closes the window CRG's answer to Register is collected in. */
  #settling: NodeJS.Timeout | undefined;

  /**
   * Reports failures rather than throwing them.
   *
   * An EventEmitter throws when an 'error' event has no listener, which
   * would take the whole plugin down the first time a connection failed.
   */
  constructor(options: CrgClientOptions = {}) {
    super();

    this.setMaxListeners(MAX_LISTENERS);
    this.#refusalShownMs = options.refusalShownMs ?? REFUSAL_SHOWN_MS;
    this.#pingIntervalMs = options.pingIntervalMs ?? PING_INTERVAL_MS;
    this.#silenceLimitMs = options.silenceLimitMs ?? SILENCE_LIMIT_MS;
    this.#snapshotSettleMs = options.snapshotSettleMs ?? SNAPSHOT_SETTLE_MS;
    this.on('error', () => undefined);
  }

  get status(): ConnectionStatus {
    return this.#status;
  }

  /** The scoreboard this client is pointed at, which is what its session belongs to. */
  get origin(): string | undefined {
    return this.#connection?.origin;
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

    if (changed) {
      // A session names this device to the scoreboard that issued it.
      // Offering it to a different one would hand that scoreboard the
      // identity this deck writes with, so it goes with the state it
      // belongs to.
      this.#session = undefined;
      this.state.clear();
    }

    if (session) {
      this.#session = session;
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
    return this.#close('disconnected');
  }

  /**
   * Disconnects on purpose, and stays disconnected until connect is called.
   *
   * The status reads 'stopped' rather than 'disconnected', so a key can
   * tell a choice to disconnect from a scoreboard that went away.
   */
  stop(): Promise<void> {
    return this.#close('stopped');
  }

  #close(status: 'disconnected' | 'stopped'): Promise<void> {
    this.#closing = true;
    this.#clearTimers();

    const closed = this.#retire();

    this.#setStatus(status);

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

    const response = await fetch(`${connection.origin}/`, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(OPEN_TIMEOUT_MS)
    });
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

    const socket = new WebSocket(connection.webSocketUrl, { headers, handshakeTimeout: OPEN_TIMEOUT_MS });
    const current = (): boolean => this.#socket === socket;

    this.#socket = socket;

    socket.on('open', () => {
      if (!current()) {
        return;
      }

      this.#reconnectDelayMs = RECONNECT_MIN_MS;
      this.#lastHeard = Date.now();
      this.#collectSnapshot();
      this.#setStatus('connected');
      this.#send({ action: 'Register', paths: [...REGISTERED_PATHS] });
      this.#ping = setInterval(() => this.#keepAlive(socket), this.#pingIntervalMs);
    });

    socket.on('message', (data: RawData) => {
      if (current()) {
        this.#lastHeard = Date.now();
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
      this.#refuse();
      this.emit('unauthorized', authorization);

      return;
    }

    if (typeof state !== 'object' || state === null) {
      return;
    }

    const delta = state as Record<string, StateValue>;

    for (const path of Object.keys(delta)) {
      this.#snapshotPaths?.add(path);
    }

    this.state.apply(delta);
  }

  /**
   * Pings CRG, or drops a socket CRG has stopped answering.
   *
   * Dropping it closes it at once, and the close starts the usual
   * reconnect.
   */
  #keepAlive(socket: WebSocket): void {
    if (Date.now() - this.#lastHeard > this.#silenceLimitMs) {
      this.emit('error', new Error(`CRG sent nothing for ${Math.round(this.#silenceLimitMs / 1000)} seconds`));
      socket.terminate();

      return;
    }

    this.#send({ action: 'Ping' });
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

  /**
   * Reports a refused write, and stops reporting it after a while.
   *
   * Authorizing the device in CRG leaves the socket open and sends
   * nothing, so a refusal that was never cleared would outlast the
   * problem and read as broken for the rest of the game.
   */
  #refuse(): void {
    this.#setStatus('unauthorized');
    clearTimeout(this.#refusal);

    this.#refusal = setTimeout(() => {
      this.#refusal = undefined;

      if (this.#status === 'unauthorized') {
        this.#setStatus('connected');
      }
    }, this.#refusalShownMs);

    this.#refusal.unref();
  }

  /**
   * Collects CRG's answer to Register, and drops what CRG did not send.
   *
   * CRG says nothing of a path deleted while the deck was away, so a path
   * the deck still holds once the answer has settled is gone from the
   * scoreboard. Its own device details are kept, since CRG sends those
   * once, ahead of the answer.
   */
  #collectSnapshot(): void {
    const paths = new Set<string>();

    this.#snapshotPaths = paths;
    clearTimeout(this.#settling);

    this.#settling = setTimeout(() => {
      this.#settling = undefined;

      if (this.#snapshotPaths !== paths) {
        return;
      }

      this.#snapshotPaths = undefined;
      this.state.prune((path) => paths.has(path) || path.startsWith(DEVICE_PREFIX));
    }, this.#snapshotSettleMs);
  }

  #clearTimers(): void {
    if (this.#settling !== undefined) {
      clearTimeout(this.#settling);
      this.#settling = undefined;
      this.#snapshotPaths = undefined;
    }

    if (this.#refusal !== undefined) {
      clearTimeout(this.#refusal);
      this.#refusal = undefined;
    }

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
