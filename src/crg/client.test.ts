import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { type AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket, WebSocketServer } from 'ws';

import { CrgClient, describeError, readSessionCookies } from './client.ts';
import { type Connection } from './settings.ts';

/** Long enough for a stray second socket to reach the server. */
const SETTLE_MS = 200;

/** A stand-in for CRG that issues a session cookie and records each socket's actions. */
class FakeCrg {
  readonly sockets: WebSocket[] = [];
  readonly actions = new Map<WebSocket, string[]>();

  #http = createServer((_request, response) => {
    response.setHeader('Set-Cookie', 'CRG_SCOREBOARD=test; Path=/');
    response.end();
  });

  #server = new WebSocketServer({ server: this.#http, path: '/WS/' });

  constructor() {
    this.#server.on('connection', (socket) => {
      const actions: string[] = [];

      this.sockets.push(socket);
      this.actions.set(socket, actions);
      socket.on('message', (data) => {
        actions.push((JSON.parse(data.toString()) as { action: string }).action);
      });
    });
  }

  get open(): WebSocket[] {
    return this.sockets.filter((socket) => socket.readyState === WebSocket.OPEN);
  }

  async start(): Promise<Connection> {
    await new Promise<void>((resolve) => this.#http.listen(0, '127.0.0.1', resolve));

    const { port } = this.#http.address() as AddressInfo;

    return { origin: `http://127.0.0.1:${port}`, webSocketUrl: `ws://127.0.0.1:${port}/WS/?source=test` };
  }

  async stop(): Promise<void> {
    for (const socket of this.sockets) {
      socket.terminate();
    }

    this.#server.close();
    this.#http.closeAllConnections();
    await new Promise((resolve) => this.#http.close(resolve));
  }
}

/** Waits for a condition, failing the test if it never holds. */
async function until(condition: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for a condition');
    }

    await delay(10);
  }
}

describe('readSessionCookies', () => {
  it('reads the cookie CRG 2027 sets', () => {
    const header =
      'CRG_SCOREBOARD=node0rsql88rbnu5tj0kg5610wgu6.node0; Path=/; ' +
      'Expires=Sun, 27-Sep-2026 17:41:29 GMT; Max-Age=1296000; HttpOnly; SameSite=Lax';

    assert.equal(readSessionCookies([header]), 'CRG_SCOREBOARD=node0rsql88rbnu5tj0kg5610wgu6.node0');
  });

  it('reads a cookie under any name, because CRG chooses it', () => {
    assert.equal(readSessionCookies(['JSESSIONID=abc123; Path=/']), 'JSESSIONID=abc123');
  });

  it('keeps every cookie it is sent', () => {
    const value = readSessionCookies(['A=1; Path=/', 'B=2; HttpOnly']);

    assert.equal(value, 'A=1; B=2');
  });

  it('returns nothing when no cookie was set', () => {
    assert.equal(readSessionCookies([]), undefined);
    assert.equal(readSessionCookies(['Path=/; HttpOnly']), undefined);
  });
});

describe('describeError', () => {
  it('includes the cause a failed fetch keeps its reason in', () => {
    const cause = new Error('connect ECONNREFUSED 127.0.0.1:8000');

    assert.equal(
      describeError(new TypeError('fetch failed', { cause })),
      'fetch failed: connect ECONNREFUSED 127.0.0.1:8000'
    );
  });

  it('uses the code when a cause has no message', () => {
    const cause = Object.assign(new AggregateError([], ''), { code: 'ECONNREFUSED' });

    assert.equal(describeError(new TypeError('fetch failed', { cause })), 'fetch failed: ECONNREFUSED');
  });

  it('reads an error without a cause as its message', () => {
    assert.equal(describeError(new Error('Unexpected server response: 404')), 'Unexpected server response: 404');
  });
});

describe('CrgClient', () => {
  let crg: FakeCrg;
  let client: CrgClient;
  let connection: Connection;

  beforeEach(async () => {
    crg = new FakeCrg();
    client = new CrgClient();
    connection = await crg.start();
  });

  afterEach(async () => {
    await client.disconnect();
    await crg.stop();
  });

  it('opens one socket and registers on it', async () => {
    client.connect(connection);
    await until(() => crg.actions.get(crg.sockets[0] as WebSocket)?.includes('Register') === true);
    await delay(SETTLE_MS);

    assert.equal(crg.sockets.length, 1);
    assert.equal(client.session, 'CRG_SCOREBOARD=test');
  });

  it('opens one socket when connect is called twice at once', async () => {
    client.connect(connection);
    client.connect(connection);
    await until(() => client.status === 'connected');
    await delay(SETTLE_MS);

    assert.equal(crg.sockets.length, 1);
    assert.deepEqual(crg.actions.get(crg.sockets[0] as WebSocket), ['Register']);
  });

  it('leaves no socket open after disconnecting', async () => {
    client.connect(connection);
    client.connect(connection);
    await until(() => client.status === 'connected');
    await client.disconnect();
    await until(() => crg.open.length === 0);

    assert.equal(client.status, 'disconnected');
  });

  it('opens no socket when disconnected while fetching a session', async () => {
    client.connect(connection);
    await client.disconnect();
    await delay(SETTLE_MS);

    assert.equal(crg.sockets.length, 0);
  });

  it('closes the old socket when reconnecting', async () => {
    client.connect(connection);
    await until(() => client.status === 'connected');
    client.reconnect();
    await until(() => crg.sockets.length === 2 && client.status === 'connected');
    await until(() => crg.open.length === 1);
    await delay(SETTLE_MS);

    assert.equal(crg.sockets.length, 2);
    assert.equal(crg.open[0], crg.sockets[1]);
  });

  it('reconnects when CRG drops the socket', async () => {
    client.connect(connection);
    await until(() => client.status === 'connected');
    crg.sockets[0]?.terminate();
    await until(() => crg.open.length === 1 && crg.sockets.length === 2);
    await until(() => crg.actions.get(crg.sockets[1] as WebSocket)?.includes('Register') === true);

    assert.deepEqual(crg.actions.get(crg.sockets[1] as WebSocket), ['Register']);
  });

  it('stays disconnected after stopping on purpose, until connect is called', async () => {
    client.connect(connection);
    await until(() => client.status === 'connected');
    await client.stop();
    await until(() => crg.open.length === 0);
    await delay(SETTLE_MS);

    assert.equal(client.status, 'stopped');
    assert.equal(crg.sockets.length, 1);

    client.connect(connection);
    await until(() => client.status === 'connected');

    assert.equal(crg.sockets.length, 2);
  });
});
