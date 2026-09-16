import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PluginSettings, sessionFor, type GlobalSettings, type Scoreboard } from './plugin-settings.ts';
import { type Connection } from './crg/settings.ts';

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

function build(held: GlobalSettings, client = scoreboard()) {
  const warnings: string[] = [];
  const chosen: (string | undefined)[] = [];
  const settings = store(held);

  return {
    settings,
    client,
    warnings,
    chosen,
    plugin: new PluginSettings({
      store: settings,
      client,
      operator: { set: (name) => void chosen.push(name) },
      warn: (message) => void warnings.push(message)
    })
  };
}

describe('sessionFor', () => {
  it('offers a session back only to the scoreboard that issued it', () => {
    const held: GlobalSettings = { session: 'CRG_SCOREBOARD=abc', sessionOrigin: 'http://scoreboard:8000' };

    assert.equal(sessionFor(held, 'http://scoreboard:8000'), 'CRG_SCOREBOARD=abc');
    assert.equal(sessionFor(held, 'http://elsewhere:8000'), undefined);
  });

  it('offers nothing when the stored session has no scoreboard, as an older setting has', () => {
    assert.equal(sessionFor({ session: 'CRG_SCOREBOARD=abc' }, 'http://localhost:8000'), undefined);
  });
});

describe('PluginSettings.apply', () => {
  it('opens the scoreboard in the settings, with the session that scoreboard issued', () => {
    const { plugin, client } = build({});

    plugin.apply({
      url: 'http://localhost:8000',
      session: 'CRG_SCOREBOARD=abc',
      sessionOrigin: 'http://localhost:8000'
    });

    assert.equal(client.opened[0]?.connection.origin, 'http://localhost:8000');
    assert.equal(client.opened[0]?.session, 'CRG_SCOREBOARD=abc');
  });

  it('withholds a session issued by a different scoreboard', () => {
    const { plugin, client } = build({});

    plugin.apply({
      url: 'http://scoreboard:8000',
      session: 'CRG_SCOREBOARD=abc',
      sessionOrigin: 'http://localhost:8000'
    });

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
  it('stores the session against the scoreboard that issued it', async () => {
    const { plugin, settings } = build({}, scoreboard('CRG_SCOREBOARD=abc', 'http://localhost:8000'));

    await plugin.rememberSession();

    assert.equal(settings.held.session, 'CRG_SCOREBOARD=abc');
    assert.equal(settings.held.sessionOrigin, 'http://localhost:8000');
  });

  it('writes nothing when the stored session already matches', async () => {
    const held: GlobalSettings = { session: 'CRG_SCOREBOARD=abc', sessionOrigin: 'http://localhost:8000' };
    const { plugin, settings } = build(held, scoreboard('CRG_SCOREBOARD=abc', 'http://localhost:8000'));

    await plugin.rememberSession();

    assert.equal(settings.writes, 0);
  });

  it('stores nothing until CRG has issued a session', async () => {
    const { plugin, settings } = build({}, scoreboard(undefined, 'http://localhost:8000'));

    await plugin.rememberSession();

    assert.equal(settings.writes, 0);
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
