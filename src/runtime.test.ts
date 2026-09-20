import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { OfflineScoreboard } from './test-support/fake-deck.ts';
import { Runtime, type Awakener } from './runtime.ts';
import { operatorSetting, replaceOnUndo } from './crg/operators.ts';

/** A stand-in for the keep awake helper, recording what it was asked to do. */
function awakener(supported = true, beta = false): Awakener & { held: number; released: number } {
  const helper = {
    supported,
    beta,
    held: 0,
    released: 0,
    get holding(): boolean {
      return helper.held > helper.released;
    },
    hold(): void {
      helper.held += 1;
    },
    release(): void {
      if (helper.holding) {
        helper.released += 1;
      }
    }
  };

  return helper;
}

/** A stand-in for the plugin settings, which a test can also make fail. */
function settings(): {
  operators: string[][];
  sessions: number;
  failing: boolean;
  rememberOperators: (names: readonly string[]) => Promise<void>;
  rememberSession: () => Promise<void>;
} {
  const held = {
    operators: [] as string[][],
    sessions: 0,
    failing: false,
    rememberOperators: (names: readonly string[]): Promise<void> => {
      if (held.failing) {
        return Promise.reject(new Error('the disk is full'));
      }

      held.operators.push([...names]);

      return Promise.resolve();
    },
    rememberSession: (): Promise<void> => {
      if (held.failing) {
        return Promise.reject(new Error('the disk is full'));
      }

      held.sessions += 1;

      return Promise.resolve();
    }
  };

  return held;
}

function build(options: { supported?: boolean; beta?: boolean } = {}) {
  const client = new OfflineScoreboard();
  const keepAwake = awakener(options.supported ?? true, options.beta ?? false);
  const stored = settings();
  const logged: string[] = [];
  const log = {
    info: (message: string) => void logged.push(`info ${message}`),
    warn: (message: string) => void logged.push(`warn ${message}`)
  };
  const runtime = new Runtime({ client, keepAwake, settings: stored, log, operatorSettleMs: 20 });

  runtime.start();

  return { client, keepAwake, settings: stored, logged, runtime };
}

describe('the plugin runtime', () => {
  let parts: ReturnType<typeof build>;

  beforeEach(() => {
    parts = build();
  });

  afterEach(async () => {
    await parts.runtime.stop('TEST');
  });

  it('logs every connection state', () => {
    parts.client.say('connecting');
    parts.client.say('connected');

    assert.deepEqual(parts.logged.slice(0, 2), ['info CRG connection connecting', 'info CRG connection connected']);
  });

  it('keeps the computer awake while connected, and lets it sleep when CRG goes', () => {
    parts.client.say('connected');

    assert.equal(parts.keepAwake.holding, true);

    parts.client.say('disconnected');

    assert.equal(parts.keepAwake.holding, false);
    assert.equal(parts.keepAwake.held, 1, 'it is held once, not once per message');
  });

  it('holds on through a refused write, since the deck is still connected', () => {
    parts.client.say('connected');
    parts.client.say('unauthorized');

    assert.equal(parts.keepAwake.holding, true);
  });

  it('says nothing about staying awake where the platform has no way to', () => {
    const elsewhere = build({ supported: false });

    elsewhere.client.say('connected');

    assert.equal(elsewhere.keepAwake.holding, false);
    assert.ok(!elsewhere.logged.some((line) => line.includes('awake')));
  });

  it('marks the Windows helper as a beta, since it ships untried', () => {
    const windows = build({ beta: true });

    windows.client.say('connected');

    assert.ok(windows.logged.some((line) => line.includes('awake') && line.includes('beta on Windows')));
  });

  it('stores the session once CRG answers', async () => {
    parts.client.say('connected');
    await delay(0);

    assert.equal(parts.settings.sessions, 1);
  });

  it('names the device CRG refused, so it can be authorized there', () => {
    parts.client.state.apply({ 'WS.Device.Name': 'lane-clockwise' });
    parts.client.emit('unauthorized', 'Not authorized for Set');

    assert.ok(parts.logged.some((line) => line.includes('lane-clockwise') && line.includes('refused')));
  });

  it('falls back to naming no device before CRG has said which it is', () => {
    parts.client.emit('unauthorized', 'Not authorized for Set');

    assert.ok(parts.logged.some((line) => line.includes("'this device'")));
  });

  it('reports a failure once, however many retries meet the same one', () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      parts.client.emit('error', new Error('connect ECONNREFUSED'));
    }

    assert.equal(parts.logged.filter((line) => line.includes('ECONNREFUSED')).length, 1);

    parts.client.emit('error', new Error('socket hang up'));

    assert.equal(parts.logged.filter((line) => line.includes('hang up')).length, 1);
  });

  it('reports the same failure again after a connection in between', () => {
    parts.client.emit('error', new Error('connect ECONNREFUSED'));
    parts.client.say('connected');
    parts.client.emit('error', new Error('connect ECONNREFUSED'));

    assert.equal(parts.logged.filter((line) => line.includes('ECONNREFUSED')).length, 2);
  });

  it('copies the operator profiles CRG holds into the settings', async () => {
    parts.client.state.apply({ [operatorSetting('Rose_City', 'ReplaceButton')]: 'true' });
    await delay(0);

    assert.deepEqual(parts.settings.operators.at(-1), ['Rose_City']);
  });

  it('creates the deck’s own profile once the list has settled', async () => {
    parts.client.say('connected');
    parts.client.state.apply({ [operatorSetting('Rose_City', 'ReplaceButton')]: 'true' });

    assert.deepEqual(parts.client.written, [], 'nothing is written while the list is still arriving');

    await delay(40);

    assert.deepEqual(parts.client.written, [{ key: replaceOnUndo('StreamDeck'), value: false, flag: '' }]);
  });

  it('leaves the deck’s own profile alone once CRG holds it', async () => {
    parts.client.say('connected');
    parts.client.state.apply({ [operatorSetting('StreamDeck', 'ReplaceButton')]: 'false' });
    await delay(40);

    assert.deepEqual(parts.client.written, []);
  });

  it('writes no profile while the deck is not connected', async () => {
    parts.client.say('disconnected');
    parts.client.state.apply({ [operatorSetting('Rose_City', 'ReplaceButton')]: 'true' });
    await delay(40);

    assert.deepEqual(parts.client.written, []);
  });

  it('says why a settings write failed, rather than leaving it unhandled', async () => {
    parts.settings.failing = true;
    parts.client.say('connected');
    parts.client.state.apply({ [operatorSetting('Rose_City', 'ReplaceButton')]: 'true' });
    await delay(0);

    assert.equal(parts.logged.filter((line) => line.includes('Could not save the plugin settings')).length, 2);
  });

  it('lets the computer sleep and closes CRG when it stops', async () => {
    parts.client.say('connected');

    await parts.runtime.stop('SIGTERM');

    assert.equal(parts.keepAwake.holding, false);
    assert.ok(parts.logged.some((line) => line === 'info Stopping on SIGTERM'));
  });
});
