import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

const toggleScript = readFileSync(new URL('ui/toggle.js', PLUGIN), 'utf8');

type Settings = Record<string, unknown>;

type FakeSwitch = {
  dataset: { setting: string };
  classList: { add: (name: string) => void };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (name: string, listener: () => void) => void;
  click: () => void;
  classes: string[];
  attributes: Map<string, string>;
};

function fakeSwitch(setting: string): FakeSwitch {
  const attributes = new Map<string, string>();
  const classes: string[] = [];
  const listeners: (() => void)[] = [];

  return {
    dataset: { setting },
    classes,
    attributes,
    classList: { add: (name: string) => classes.push(name) },
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    getAttribute: (name: string) => attributes.get(name) ?? null,
    addEventListener: (name: string, listener: () => void) => void (name === 'click' && listeners.push(listener)),
    click: () => listeners.forEach((listener) => listener())
  };
}

type Inspector = {
  element: FakeSwitch;
  saved: Settings[];
  arrive: () => Promise<void>;
  /** Sends the page settings the plugin wrote, as Stream Deck does. */
  receive: (settings: Settings) => void;
};

/**
 * Runs ui/toggle.js on a stand-in property inspector holding one switch.
 *
 * The settings are handed over only when the test asks, so a click
 * landing before Stream Deck answers can be tested as well.
 */
function open(stored: Settings): Inspector {
  const element = fakeSwitch('replaceOnUndo');
  const saved: Settings[] = [];
  const style = { textContent: '' };
  let answer: (settings: { settings: Settings }) => void = () => undefined;
  const settings = new Promise<{ settings: Settings }>((resolve) => (answer = resolve));
  const listeners: ((message: { payload: { settings: Settings } }) => void)[] = [];

  runInNewContext(toggleScript, {
    window: {
      SDPIComponents: {
        streamDeckClient: {
          getSettings: () => settings,
          setSettings: async (next: Settings) => void saved.push(next),
          didReceiveSettings: { subscribe: (listener: (typeof listeners)[number]) => void listeners.push(listener) }
        }
      }
    },
    document: {
      createElement: () => style,
      head: { append: () => undefined },
      querySelectorAll: (selector: string) => (selector === '[data-setting]' ? [element] : [])
    }
  });

  return {
    element,
    saved,
    arrive: async () => {
      answer({ settings: stored });
      await setImmediate();
    },
    receive: (next) => listeners.forEach((listener) => listener({ payload: { settings: next } }))
  };
}

/** Runs ui/toggle.js and waits for the settings to arrive, as a property inspector normally does. */
async function connect(stored: Settings): Promise<Inspector> {
  const inspector = open(stored);

  await inspector.arrive();

  return inspector;
}

describe('the property inspector switch', () => {
  it('draws as a switch, and shows the setting it was given', async () => {
    const { element } = await connect({ replaceOnUndo: true });

    assert.deepEqual(element.classes, ['sdpi-switch']);
    assert.equal(element.attributes.get('role'), 'switch');
    assert.equal(element.attributes.get('aria-checked'), 'true');
  });

  it('reads a setting CRG or Stream Deck kept as text', async () => {
    const { element } = await connect({ replaceOnUndo: 'true' });

    assert.equal(element.attributes.get('aria-checked'), 'true');
  });

  it('is off when the setting has never been set', async () => {
    const { element } = await connect({});

    assert.equal(element.attributes.get('aria-checked'), 'false');
  });

  it('saves the setting when it is used, keeping the settings around it', async () => {
    const { element, saved } = await connect({ replaceOnUndo: true, other: 'kept' });

    element.click();

    assert.equal(element.attributes.get('aria-checked'), 'false');
    assert.deepEqual({ ...saved[0] }, { replaceOnUndo: false, other: 'kept' });

    element.click();

    assert.deepEqual({ ...saved[1] }, { replaceOnUndo: true, other: 'kept' });
    assert.equal(saved.length, 2);
  });

  it('saves nothing while it is still waiting for the settings', async () => {
    const inspector = open({ replaceOnUndo: true, other: 'kept' });

    assert.equal(inspector.element.attributes.get('aria-busy'), 'true');

    inspector.element.click();

    assert.equal(inspector.saved.length, 0);

    await inspector.arrive();

    assert.equal(inspector.element.attributes.get('aria-busy'), 'false');
    assert.equal(inspector.element.attributes.get('aria-checked'), 'true');

    inspector.element.click();

    assert.deepEqual({ ...inspector.saved[0] }, { replaceOnUndo: false, other: 'kept' });
  });
});

describe('the property inspector switch, while the page is open', () => {
  it('follows a value the plugin writes, and saves from it', async () => {
    const { element, saved, receive } = await connect({ replaceOnUndo: false, other: 'kept' });

    receive({ replaceOnUndo: true, other: 'kept' });

    assert.equal(element.attributes.get('aria-checked'), 'true');

    element.click();

    assert.deepEqual({ ...saved[0] }, { replaceOnUndo: false, other: 'kept' });
  });
});

describe('the property inspector pages', () => {
  it('name every switch, since its label sits in a shadow root a reader cannot reach', () => {
    const ui = new URL('ui/', PLUGIN);

    for (const file of readdirSync(ui).filter((name) => name.endsWith('.html'))) {
      const markup = readFileSync(new URL(file, ui), 'utf8');

      for (const element of markup.match(/<button[^>]*data-setting=[^>]*>/g) ?? []) {
        assert.match(element, /aria-label="[^"]+"/, `${file}: ${element}`);
      }
    }
  });
});
