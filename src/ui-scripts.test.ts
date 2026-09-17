import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

/** Every script a property inspector loads, in the order the pages load them. */
const SCRIPTS = ['ui/operators.js', 'ui/toggle.js', 'ui/descriptions.js'];

type Element = Record<string, unknown>;

/** Enough of a page for the scripts to run against, which is all this needs to prove. */
function page(): Record<string, unknown> {
  const element = (): Element => {
    const node: Element = {
      dataset: {},
      classList: { add: () => undefined, toggle: () => undefined },
      style: {},
      textContent: '',
      value: '',
      hidden: false,
      disabled: false,
      nodeValue: '',
      parentNode: null,
      parentElement: { hidden: false },
      setAttribute: () => undefined,
      getAttribute: () => null,
      hasAttribute: () => false,
      toggleAttribute: () => false,
      removeAttribute: () => undefined,
      click: () => undefined,
      addEventListener: () => undefined,
      append: () => undefined,
      replaceChildren: () => undefined,
      insertBefore: () => undefined,
      removeChild: () => undefined,
      focus: () => undefined
    };

    return node;
  };

  const client = {
    getConnectionInfo: async () => ({ actionInfo: { action: 'com.rcrderby.crg-streamdeck.undo' } }),
    getSettings: async () => ({ settings: {} }),
    setSettings: async () => undefined,
    getGlobalSettings: async () => ({ operator: 'StreamDeck', operators: ['Andy', 'StreamDeck'] }),
    setGlobalSettings: async () => undefined,
    send: () => undefined,
    didReceiveGlobalSettings: { subscribe: () => undefined }
  };

  return {
    window: { SDPIComponents: { streamDeckClient: client } },
    NodeFilter: { SHOW_TEXT: 4 },
    document: {
      body: element(),
      head: { append: () => undefined },
      createElement: () => element(),
      createTextNode: () => element(),
      createTreeWalker: () => ({ nextNode: () => false, currentNode: element() }),
      getElementById: () => element(),
      querySelector: () => null,
      querySelectorAll: () => []
    }
  };
}

describe('the property inspector scripts', () => {
  it('run together in one page without colliding', async () => {
    const context = page();

    for (const name of SCRIPTS) {
      const source = readFileSync(new URL(name, PLUGIN), 'utf8');

      assert.doesNotThrow(() => runInNewContext(source, context), `${name} clashes with a script loaded before it`);
    }

    await setImmediate();
  });

  it('keep their names to themselves, apart from the descriptions the build reads', () => {
    for (const name of ['ui/operators.js', 'ui/toggle.js']) {
      const source = readFileSync(new URL(name, PLUGIN), 'utf8')
        .replace(/^\s*\/\/.*$/gm, '')
        .trim();

      assert.ok(source.startsWith('(() => {'), `${name} should keep its declarations inside a wrapper`);
    }
  });
});
