import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PluginSettings, sessionFor, type GlobalSettings, type Scoreboard } from './plugin-settings.ts';
import { type Connection } from './crg/settings.ts';
import { type SessionStore, type StoredSession } from './session-file.ts';

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

function build(held: GlobalSettings, client = scoreboard(), session = sessionStore()) {
  const warnings: string[] = [];
  const chosen: (string | undefined)[] = [];
  const settings = store(held);

  return {
    settings,
    client,
    session,
    warnings,
    chosen,
    plugin: new PluginSettings({
      store: settings,
      session,
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

  it('stays disconnected when the deck was disconnected on purpose', () => {
    const { plugin, client } = build({});

    plugin.apply({ url: 'http://localhost:8000', stopped: true });

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

describe('PluginSettings.rememberOperators', () => {
  it('copies the profiles CRG holds where a property inspector can read them', async () => {
    const { plugin, settings } = build({});

    await plugin.rememberOperators(['Rose_City', 'StreamDeck']);

    assert.deepEqual(settings.held.operators, ['Rose_City', 'StreamDeck']);
  });

  it('writes nothing when the list has not changed, or has not arrived', async () => {
    const { plugin, settings } = build({ operators: ['StreamDeck'] });

    await plugin.rememberOperators(['StreamDeck']);
    await plugin.rememberOperators([]);

    assert.equal(settings.writes, 0);
  });
});

describe('PluginSettings.setStopped', () => {
  it('remembers a deck disconnected on purpose, and stops it', async () => {
    const { plugin, settings, client } = build({ url: 'http://localhost:8000' });

    await plugin.setStopped(true);

    assert.equal(settings.held.stopped, true);
    assert.equal(client.stopped, 1);
  });

  it('connects again, keeping the settings around the choice', async () => {
    const { plugin, settings, client } = build({ url: 'http://localhost:8000', stopped: true });

    await plugin.setStopped(false);

    assert.equal(settings.held.stopped, false);
    assert.equal(settings.held.url, 'http://localhost:8000');
    assert.equal(client.opened[0]?.connection.origin, 'http://localhost:8000');
  });
});

describe('PluginSettings writes', () => {
  it('keeps every change when two are saved at once', async () => {
    const { plugin, settings } = build(
      { url: 'http://localhost:8000' },
      scoreboard('CRG_SCOREBOARD=abc', 'http://localhost:8000')
    );

    await Promise.all([plugin.rememberSession(), plugin.rememberOperators(['Rose_City']), plugin.setStopped(true)]);

    assert.deepEqual(settings.held.operators, ['Rose_City']);
    assert.equal(settings.held.stopped, true);
    assert.equal(settings.held.url, 'http://localhost:8000');
  });
});
