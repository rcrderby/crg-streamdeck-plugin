// Writes each action's Tooltip in manifest.json from ui/descriptions.js,
// where descriptions are edited: the summary and details as one line.
//
//     node scripts/sync-tooltips.mjs
//
// The build runs this too, so a build always carries current tooltips.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { format, resolveConfig } from 'prettier';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

export const DESCRIPTIONS_FILE = fileURLToPath(new URL('ui/descriptions.js', PLUGIN));

const MANIFEST_FILE = fileURLToPath(new URL('manifest.json', PLUGIN));

/** Reads the descriptions ui/descriptions.js defines, without a property inspector to show them in. */
export async function readDescriptions() {
  const source = await readFile(DESCRIPTIONS_FILE, 'utf8');
  const context = {
    window: { SDPIComponents: { streamDeckClient: { getConnectionInfo: () => new Promise(() => undefined) } } }
  };

  runInNewContext(source, context);

  return context.CRG_DESCRIPTIONS;
}

/** A description as the single line Stream Deck shows on hover. */
export function tooltip({ summary, details = [] }) {
  return [summary, ...details].join(' ');
}

/** Rewrites the manifest's tooltips, and reports whether any changed. */
export async function syncTooltips() {
  const descriptions = await readDescriptions();
  const current = await readFile(MANIFEST_FILE, 'utf8');
  const manifest = JSON.parse(current);

  for (const action of manifest.Actions) {
    const description = descriptions[action.UUID];

    if (description === undefined) {
      throw new Error(`ui/descriptions.js has no description for ${action.UUID}`);
    }

    action.Tooltip = tooltip(description);
  }

  const options = (await resolveConfig(MANIFEST_FILE)) ?? {};
  const updated = await format(JSON.stringify(manifest), { ...options, filepath: MANIFEST_FILE });

  if (updated === current) {
    return false;
  }

  await writeFile(MANIFEST_FILE, updated);

  return true;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const changed = await syncTooltips();

  process.stdout.write(changed ? 'Updated the tooltips in manifest.json\n' : 'Tooltips already match\n');
}
