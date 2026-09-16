import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

/** Runs ui/toggle.js on a stand-in property inspector holding one switch. */
async function connect(stored: Settings): Promise<{ element: FakeSwitch; saved: Settings[] }> {
  const element = fakeSwitch('replaceOnUndo');
  const saved: Settings[] = [];
  const style = { textContent: '' };

  runInNewContext(toggleScript, {
    window: {
      SDPIComponents: {
        streamDeckClient: {
          getSettings: async () => ({ settings: stored }),
          setSettings: async (settings: Settings) => void saved.push(settings)
        }
      }
    },
    document: {
      createElement: () => style,
      head: { append: () => undefined },
      querySelectorAll: (selector: string) => (selector === '[data-setting]' ? [element] : [])
    }
  });

  await setImmediate();

  return { element, saved };
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
});
