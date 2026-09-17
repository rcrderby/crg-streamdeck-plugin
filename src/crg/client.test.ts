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

  /** Whether this scoreboard answers a ping, as CRG does. */
  answersPings = true;

  /** What this scoreboard sends in answer to a Register. */
  holds: Record<string, unknown> = {};

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
      socket.send(JSON.stringify({ state: { 'WS.Device.Name': 'Test deck' } }));
      socket.on('message', (data) => {
        const { action } = JSON.parse(data.toString()) as { action: string };

        actions.push(action);

        if (action === 'Register') {
          socket.send(JSON.stringify({ state: this.holds }));
        } else if (action === 'Ping' && this.answersPings) {
          socket.send(JSON.stringify({ Pong: '' }));
        }
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

  it('keeps only the cookie that reads as a session', () => {
    assert.equal(readSessionCookies(['CRG_SCOREBOARD=abc; Path=/', 'theme=dark; Path=/']), 'CRG_SCOREBOARD=abc');
    assert.equal(readSessionCookies(['theme=dark', 'JSESSIONID=abc; HttpOnly']), 'JSESSIONID=abc');
  });

  it('keeps every cookie when none reads as a session, since CRG chooses the name', () => {
    const value = readSessionCookies(['A=1; Path=/', 'B=2; HttpOnly']);

    assert.equal(value, 'A=1; B=2');
  });

  it('returns nothing when no cookie was set', () => {
    assert.equal(readSessionCookies([]), undefined);
    assert.equal(readSessionCookies(['Path=/; HttpOnly']), undefined);
  });
});

describe('a client nothing is listening to', () => {
  it('reports a failure rather than throwing it, which would end the plugin', () => {
    assert.doesNotThrow(() => new CrgClient().emit('error', new Error('connect ECONNREFUSED 127.0.0.1:8000')));
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

  it('keeps its session while the address stays the same', async () => {
    client.connect(connection, 'CRG_SCOREBOARD=stored');
    await until(() => client.status === 'connected');

    assert.equal(client.origin, connection.origin);

    client.connect(connection);

    assert.equal(client.session, 'CRG_SCOREBOARD=test');
  });

  it('forgets its session when it is pointed at a different scoreboard', async () => {
    client.connect(connection);
    await until(() => client.status === 'connected');

    assert.equal(client.session, 'CRG_SCOREBOARD=test');

    const elsewhere: Connection = { origin: 'http://127.0.0.1:1/', webSocketUrl: 'ws://127.0.0.1:1/WS/?source=test' };

    client.connect(elsewhere);

    assert.equal(client.session, undefined);
    assert.equal(client.origin, elsewhere.origin);
  });

  it('reports a refused write for a while, then stops, since CRG never says it was allowed', async () => {
    const refused = new CrgClient({ refusalShownMs: 30 });

    try {
      refused.connect(connection);
      await until(() => refused.status === 'connected');

      crg.sockets[0]?.send(JSON.stringify({ authorization: 'Not authorized for Set' }));
      await until(() => refused.status === 'unauthorized');
      await until(() => refused.status === 'connected');
    } finally {
      await refused.disconnect();
    }
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

  it('keeps a connection CRG keeps answering', async () => {
    const pinging = new CrgClient({ pingIntervalMs: 20, silenceLimitMs: 60 });

    try {
      pinging.connect(connection);
      await until(() => pinging.status === 'connected');
      await delay(SETTLE_MS);

      assert.equal(crg.sockets.length, 1);
      assert.equal(pinging.status, 'connected');
    } finally {
      await pinging.disconnect();
    }
  });

  it('drops and reopens a connection CRG has stopped answering', async () => {
    const pinging = new CrgClient({ pingIntervalMs: 20, silenceLimitMs: 60 });
    const errors: string[] = [];

    pinging.on('error', (cause) => errors.push(cause.message));
    crg.answersPings = false;

    try {
      pinging.connect(connection);
      await until(() => crg.sockets.length === 2);

      assert.match(errors[0] ?? '', /sent nothing/);
    } finally {
      await pinging.disconnect();
    }
  });

  it('forgets what CRG deleted while the deck was away', async () => {
    const running = 'ScoreBoard.CurrentGame.Period(1).Timeout(a).Running';
    const score = 'ScoreBoard.CurrentGame.Team(1).Score';
    let told = 0;

    crg.holds = { [running]: true, [score]: 4 };
    client.state.subscribe([running], (changed) => {
      told += changed.has(running) ? 1 : 0;
    });
    client.connect(connection);
    await until(() => client.state.get(running) === true);

    crg.holds = { [score]: 4 };
    crg.sockets[0]?.terminate();
    await until(() => crg.sockets.length === 2 && client.state.get(running) === undefined);

    assert.equal(client.state.get(score), 4);
    assert.equal(client.state.get('WS.Device.Name'), 'Test deck');
    assert.equal(told, 2);
  });

  it('applies what CRG sends after its snapshot as changes', async () => {
    const score = 'ScoreBoard.CurrentGame.Team(1).Score';
    const jam = 'ScoreBoard.CurrentGame.Team(1).JamScore';

    crg.holds = { [score]: 4, [jam]: 1 };
    client.connect(connection);
    await until(() => client.state.get(jam) === 1);

    crg.sockets[0]?.send(JSON.stringify({ state: { [score]: 8 } }));
    await until(() => client.state.get(score) === 8);

    assert.equal(client.state.get(jam), 1);
  });
});
