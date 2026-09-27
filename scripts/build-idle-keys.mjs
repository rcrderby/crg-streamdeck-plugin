// Writes the picture Stream Deck shows on each key until the plugin draws
// it, from the idle design in src/render/designs.ts.
//
//     node scripts/build-idle-keys.mjs
//
// The build runs this too. Each action's picture is the file its manifest
// state names, drawn with the action's name, so a new action gets one and
// a renamed action's picture follows.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

const { renderKeySvg } = await import('../src/render/key.ts');
const { idleKey } = await import('../src/render/designs.ts');

/** The idle picture for one action, as the file holds it. */
export function idleImage(name) {
  return `${renderKeySvg(idleKey(name))}\n`;
}

export async function buildIdleKeys() {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', PLUGIN), 'utf8'));

  for (const action of manifest.Actions) {
    for (const state of action.States) {
      await writeFile(fileURLToPath(new URL(`${state.Image}.svg`, PLUGIN)), idleImage(action.Name));
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await buildIdleKeys();
}
