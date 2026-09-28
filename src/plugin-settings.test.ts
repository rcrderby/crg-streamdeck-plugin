import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PluginSettings, sessionFor, type GlobalSettings, type Scoreboard } from './plugin-settings.ts';
import { type Connection } from './crg/settings.ts';
import { type SessionStore, type StoredSession } from './session-file.ts';
import { type StoppedStore } from './connection-file.ts';

type Opened = { connection: Connection; session: string | undefined };

/** A stand-in for the CRG client, recording what it was asked to open. */
function scoreboard(session?: string, origin?: string): Scoreboard & { opened: Opened[]; stopped: number } {
  const opened: Opened[] = [];

  return {
    opened,
    stopped: 0,
    session,
    origin,
    connect(connection, offered) {
      opened.push({ connection, session: offered });
    },
    stop() {
      this.stopped += 1;

      return Promise.resolve();
    }
  };
}

/** A stand-in for Stream Deck's global settings. */
function store(held: GlobalSettings = {}): {
  getGlobalSettings: <T>() => Promise<T>;
  setGlobalSettings: (settings: GlobalSettings) => Promise<void>;
  held: GlobalSettings;
  writes: number;
} {
  const state = {
    held,
    writes: 0,
    getGlobalSettings: <T>(): Promise<T> => Promise.resolve({ ...state.held } as T),
    setGlobalSettings: (settings: GlobalSettings): Promise<void> => {
      state.held = settings;
      state.writes += 1;

      return Promise.resolve();
    }
  };

  return state;
}

/** A stand-in for the session file, which a test can also make fail. */
function sessionStore(stored?: StoredSession): SessionStore & { held: StoredSession | undefined; failing: boolean } {
  const file = {
    held: stored,
    failing: false,
    read: (): Promise<StoredSession | undefined> =>
      file.failing ? Promise.reject(new Error('no such file')) : Promise.resolve(file.held),
    write: (value: StoredSession): Promise<void> => {
      if (file.failing) {
        return Promise.reject(new Error('read-only folder'));
      }

      file.held = value;

      return Promise.resolve();
    }
  };

  return file;
}

/** A stand-in for the file that says whether the deck was disconnected on purpose. */
function stoppedStore(stopped = false): StoppedStore & { held: boolean; failing: boolean } {
  const file = {
    held: stopped,
    failing: false,
    read: (): Promise<boolean> => Promise.resolve(file.held),
    write: (value: boolean): Promise<void> => {
      if (file.failing) {
        return Promise.reject(new Error('read-only folder'));
      }

      file.held = value;

      return Promise.resolve();
    }
  };

  return file;
}

function build(held: GlobalSettings, client = scoreboard(), session = sessionStore(), stopped = stoppedStore()) {
  const warnings: string[] = [];
  const chosen: (string | undefined)[] = [];
  const settings = store(held);

  return {
    settings,
    client,
    session,
    stopped,
    warnings,
    chosen,
    plugin: new PluginSettings({
      store: settings,
      session,
      stopped,
      client,
      operator: { set: (name) => void chosen.push(name) },
      warn: (message) => void warnings.push(message)
    })
  };
}

describe('sessionFor', () => {
  it('offers a session back only to the scoreboard that issued it', () => {
    const stored: StoredSession = { session: 'CRG_SCOREBOARD=abc', origin: 'http://scoreboard:8000' };

    assert.equal(sessionFor(stored, 'http://scoreboard:8000'), 'CRG_SCOREBOARD=abc');
    assert.equal(sessionFor(stored, 'http://elsewhere:8000'), undefined);
  });

  it('offers nothing when nothing is stored', () => {
    assert.equal(sessionFor(undefined, 'http://localhost:8000'), undefined);
  });
});

describe('PluginSettings.load', () => {
  it('reads the stored session, which the next connection offers CRG', async () => {
    const stored: StoredSession = { session: 'CRG_SCOREBOARD=abc', origin: 'http://localhost:8000' };
    const { plugin, client } = build({}, scoreboard(), sessionStore(stored));

    await plugin.load();
    plugin.apply({ url: 'http://localhost:8000' });

    assert.equal(client.opened[0]?.session, 'CRG_SCOREBOARD=abc');
  });

  it('says why a session could not be read, and connects as a new device', async () => {
    const session = sessionStore();
    const { plugin, client, warnings } = build({}, scoreboard(), session);

    session.failing = true;
    await plugin.load();
    plugin.apply({ url: 'http://localhost:8000' });

    assert.match(warnings[0] ?? '', /Could not read the stored CRG session/);
    assert.equal(client.opened[0]?.session, undefined);
  });
});

describe('PluginSettings.apply', () => {
  it('opens the scoreboard in the settings, with the session that scoreboard issued', async () => {
    const stored: StoredSession = { session: 'CRG_SCOREBOARD=abc', origin: 'http://localhost:8000' };
    const { plugin, client } = build({}, scoreboard(), sessionStore(stored));

    await plugin.load();
    plugin.apply({ url: 'http://localhost:8000' });

    assert.equal(client.opened[0]?.connection.origin, 'http://localhost:8000');
    assert.equal(client.opened[0]?.session, 'CRG_SCOREBOARD=abc');
  });

  it('withholds a session issued by a different scoreboard', async () => {
    const stored: StoredSession = { session: 'CRG_SCOREBOARD=abc', origin: 'http://localhost:8000' };
    const { plugin, client } = build({}, scoreboard(), sessionStore(stored));

    await plugin.load();
    plugin.apply({ url: 'http://scoreboard:8000' });

    assert.equal(client.opened[0]?.connection.origin, 'http://scoreboard:8000');
    assert.equal(client.opened[0]?.session, undefined);
  });

  it('stays disconnected when the deck was disconnected on purpose', async () => {
    const { plugin, client } = build({}, scoreboard(), sessionStore(), stoppedStore(true));

    await plugin.load();
    plugin.apply({ url: 'http://localhost:8000' });

    assert.equal(client.stopped, 1);
    assert.equal(client.opened.length, 0);
  });

  it('says why an unusable URL was not opened, and leaves the plugin running', () => {
    const { plugin, client, warnings } = build({});

    plugin.apply({ url: 'ftp://scoreboard' });

    assert.equal(client.opened.length, 0);
    assert.match(warnings[0] ?? '', /not usable/);
  });

  it('points the plugin at the operator profile in the settings', () => {
    const { plugin, chosen } = build({});

    plugin.apply({ url: 'http://localhost:8000', operator: 'Wheels' });

    assert.deepEqual(chosen, ['Wheels']);
  });
});

describe('PluginSettings.rememberSession', () => {
  it('stores the session in the file, against the scoreboard that issued it', async () => {
    const { plugin, session, settings } = build({}, scoreboard('CRG_SCOREBOARD=abc', 'http://localhost:8000'));

    await plugin.rememberSession();

    assert.deepEqual(session.held, { session: 'CRG_SCOREBOARD=abc', origin: 'http://localhost:8000' });
    assert.equal(settings.writes, 0, 'the session never reaches the settings a property inspector reads');
  });

  it('writes nothing when the stored session already matches', async () => {
    const stored: StoredSession = { session: 'CRG_SCOREBOARD=abc', origin: 'http://localhost:8000' };
    const { plugin, session } = build(
      {},
      scoreboard('CRG_SCOREBOARD=abc', 'http://localhost:8000'),
      sessionStore(stored)
    );

    await plugin.load();
    session.failing = true;
    await plugin.rememberSession();

    assert.deepEqual(session.held, stored);
  });

  it('stores nothing until CRG has issued a session', async () => {
    const { plugin, session } = build({}, scoreboard(undefined, 'http://localhost:8000'));

    await plugin.rememberSession();

    assert.equal(session.held, undefined);
  });

  it('says why a session could not be stored, and carries on', async () => {
    const session = sessionStore();
    const { plugin, warnings } = build({}, scoreboard('CRG_SCOREBOARD=abc', 'http://localhost:8000'), session);

    session.failing = true;
    await plugin.rememberSession();

    assert.match(warnings[0] ?? '', /Could not store the CRG session/);
  });
});

describe('PluginSettings.chooseOperator', () => {
  it('uses the profile at once and stores it, once', async () => {
    const { plugin, settings, chosen } = build({ url: 'http://localhost:8000', operator: 'Elsewhere' });

    await plugin.chooseOperator('StreamDeck');
    await plugin.chooseOperator('StreamDeck');

    assert.deepEqual(chosen, ['StreamDeck', 'StreamDeck']);
    assert.deepEqual(settings.held, { url: 'http://localhost:8000', operator: 'StreamDeck' });
    assert.equal(settings.writes, 1);
  });
});

describe('PluginSettings.setStopped', () => {
  it('remembers a deck disconnected on purpose in its own file, and stops it', async () => {
    const { plugin, settings, stopped, client } = build({ url: 'http://localhost:8000' });

    plugin.apply({ url: 'http://localhost:8000' });
    await plugin.setStopped(true);

    assert.equal(stopped.held, true);
    assert.equal(client.stopped, 1);
    assert.equal(settings.writes, 0, 'nothing goes to the settings every property inspector writes');
  });

  it('connects again to the scoreboard the settings name', async () => {
    const { plugin, stopped, client } = build({}, scoreboard(), sessionStore(), stoppedStore(true));

    await plugin.load();
    plugin.apply({ url: 'http://scoreboard:8000' });
    await plugin.setStopped(false);

    assert.equal(stopped.held, false);
    assert.equal(client.opened[0]?.connection.origin, 'http://scoreboard:8000');
  });

  it('keeps a property inspector from undoing the choice by writing an older copy of the settings', async () => {
    const { plugin, client } = build({ url: 'http://localhost:8000' });

    plugin.apply({ url: 'http://localhost:8000' });
    await plugin.setStopped(true);
    plugin.apply({ url: 'http://localhost:8000', operator: 'StreamDeck' });

    assert.equal(client.opened.length, 1, 'only the connection made before the deck was disconnected');
    assert.equal(client.stopped, 2);
  });

  it('acts on the choice even when it cannot be saved, and says so', async () => {
    const stopped = stoppedStore();
    const { plugin, client, warnings } = build({}, scoreboard(), sessionStore(), stopped);

    stopped.failing = true;
    plugin.apply({ url: 'http://localhost:8000' });
    await plugin.setStopped(true);

    assert.equal(client.stopped, 1);
    assert.ok(warnings.some((line) => line.startsWith('Could not remember that the deck was disconnected')));
  });
});

describe('PluginSettings writes', () => {
  it('keeps every change when two are saved at once', async () => {
    const { plugin, settings } = build(
      { url: 'http://localhost:8000' },
      scoreboard('CRG_SCOREBOARD=abc', 'http://localhost:8000')
    );

    await Promise.all([plugin.rememberSession(), plugin.chooseOperator('Rose_City'), plugin.setStopped(true)]);

    assert.equal(settings.held.operator, 'Rose_City');
    assert.equal(settings.held.url, 'http://localhost:8000');
  });
});
