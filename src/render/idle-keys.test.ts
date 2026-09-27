import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { estimateTextWidth, renderKeySvg } from './key.ts';
import { idleKey } from './designs.ts';

const PLUGIN = new URL('../../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

const manifest = JSON.parse(readFileSync(new URL('manifest.json', PLUGIN), 'utf8')) as {
  Actions: { Name: string; States: { Image: string }[] }[];
};

const words = (name: string): string[] => (idleKey(name).texts ?? []).map((line) => line.text);

describe('the idle key', () => {
  it('draws an empty slot in dashes, with no bar and no word of its own', () => {
    const spec = idleKey('Lead');

    assert.equal(spec.bar, undefined);
    assert.deepEqual(words('Lead'), ['Lead']);
    assert.match(renderKeySvg(spec), /stroke-dasharray="7 6"/);
  });

  it('breaks a long name across lines that each fit inside the outline', () => {
    const name = 'Show Clock During Final Score';

    assert.deepEqual(words(name).join(' '), name);
    assert.ok(words(name).length > 1);

    for (const line of idleKey(name).texts ?? []) {
      assert.ok(estimateTextWidth(line.text, line.size, 'bold') <= 70, line.text);
    }
  });

  it('keeps every action’s name to three lines, smaller if it has to be', () => {
    for (const action of manifest.Actions) {
      assert.ok(words(action.Name).length <= 3, action.Name);
    }

    assert.equal(idleKey('Lead').texts?.[0]?.size, 13);
    assert.ok((idleKey('Show Clock During Final Score').texts?.[0]?.size ?? 13) < 13);
  });

  it('centers the name on the key', () => {
    for (const name of ['Lead', 'End of Period Controls', 'Show Clock During Final Score']) {
      const lines = idleKey(name).texts ?? [];
      const top = (lines[0]?.y ?? 0) - (lines[0]?.size ?? 0) * 0.72;
      const bottom = lines.at(-1)?.y ?? 0;

      assert.ok(Math.abs(top + bottom - 100) < 1, name);
    }
  });

  it('escapes a name, as every key does', () => {
    const svg = renderKeySvg(idleKey('Q&A <Test>'));

    assert.match(svg, />Q&amp;A</);
    assert.match(svg, />&lt;Test&gt;</);
  });

  it('is the picture the manifest names for every action', () => {
    for (const action of manifest.Actions) {
      for (const state of action.States) {
        assert.equal(
          readFileSync(new URL(`${state.Image}.svg`, PLUGIN), 'utf8'),
          `${renderKeySvg(idleKey(action.Name))}\n`,
          `${action.Name}: run the build to redraw it`
        );
      }
    }
  });
});
