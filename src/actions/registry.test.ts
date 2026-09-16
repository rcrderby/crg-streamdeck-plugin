import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { FakeDeck } from '../test-support/fake-deck.ts';
import { keyActions } from './registry.ts';

const manifest = JSON.parse(
  readFileSync(new URL('../../com.rcrderby.crg-streamdeck.sdPlugin/manifest.json', import.meta.url), 'utf8')
) as { Actions: { UUID: string; SupportedInMultiActions?: boolean }[] };

describe('the actions the plugin registers', () => {
  it('are exactly the ones the manifest declares', () => {
    const deck = new FakeDeck();
    const registered = keyActions(deck.context).map((keyAction) => keyAction.manifestId);

    deck.stop();

    assert.deepEqual([...registered].sort(), manifest.Actions.map((entry) => entry.UUID).sort());
  });

  it('carry an identifier each, since registering one without it throws', () => {
    const deck = new FakeDeck();

    for (const keyAction of keyActions(deck.context)) {
      assert.match(keyAction.manifestId ?? '', /^com\.rcrderby\.crg-streamdeck\./);
    }

    deck.stop();
  });

  it('say for every entry whether it belongs in a Multi Action, rather than falling to the default', () => {
    for (const entry of manifest.Actions) {
      assert.equal(typeof entry.SupportedInMultiActions, 'boolean', entry.UUID);
    }
  });
});
