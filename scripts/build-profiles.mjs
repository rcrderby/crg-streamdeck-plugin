// Writes the pages of keys the plugin ships, one .streamDeckProfile for
// each page and Stream Deck model, and lists them in manifest.json.
//
//     node scripts/build-profiles.mjs
//
// The build runs this too. Each file follows the layout Stream Deck 7.4
// exports: a package.json, then the profile under Profiles/ with version
// 3.0 manifests and its pages in folders named by their UUIDs.
// Identifiers and timestamps are fixed, so an unchanged page writes the
// same bytes. The models match PAGE_DEVICES in src/pages.ts, and a test
// holds the two together.

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { crc32 } from 'node:zlib';
import { format, resolveConfig } from 'prettier';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

const MANIFEST_FILE = fileURLToPath(new URL('manifest.json', PLUGIN));

const PLUGIN_UUID = 'com.rcrderby.crg-streamdeck';

/** The supported Stream Deck version. */
const APP_VERSION = '7.4.0.0';

/** The models a page ships for, with the model number Stream Deck records in a profile. */
const DEVICES = [
  { type: 0, name: 'stream-deck', model: '20GBA9901' },
  { type: 1, name: 'mini', model: '20GAI9902' },
  { type: 2, name: 'xl', model: '20GAT9901' },
  { type: 3, name: 'mobile', model: 'VSD/WiFi' },
  { type: 7, name: 'plus', model: '20GBD9901', encoders: true },
  { type: 9, name: 'neo', model: '20GBJ9901' },
  { type: 10, name: 'studio', model: '20GBO9901', encoders: true },
  { type: 11, name: 'virtual', model: 'UI Stream Deck' },
  { type: 13, name: 'plus-xl', model: '20GBX9901', encoders: true }
];

/** Each page's keys by column and row, all within the top left three columns and two rows. */
const PAGES = {
  connection: {
    title: 'CRG Connection',
    keys: {
      '0,0': { slug: 'back', name: 'Back' },
      '1,0': { slug: 'connection-toggle', name: 'Connect or Disconnect' }
    }
  },
  undo: {
    title: 'CRG Replace on Undo',
    keys: {
      '0,0': { slug: 'replace-info', name: 'Replacing' },
      '1,0': { slug: 'replace-confirm', name: 'No Action' },
      '2,0': { slug: 'back', name: 'Back' },
      '0,1': { slug: 'replace-choice', name: 'Replace Choice', settings: { slot: 0 } },
      '1,1': { slug: 'replace-choice', name: 'Replace Choice', settings: { slot: 1 } },
      '2,1': { slug: 'replace-choice', name: 'Replace Choice', settings: { slot: 2 } }
    }
  },
  automation: {
    title: 'CRG Automation',
    keys: {
      '0,0': { slug: 'back', name: 'Back' },
      '1,0': { slug: 'auto-end-jams', name: 'Auto End Jams' },
      '2,0': { slug: 'auto-end-team-timeouts', name: 'Auto End Team Timeouts' }
    }
  },
  'end-of-period': {
    title: 'CRG End of Period',
    keys: {
      '0,0': { slug: 'back', name: 'Back' },
      '1,0': { slug: 'official-score', name: 'Official Score' },
      '2,0': { slug: 'period-end-timeout', name: 'Timeout Before Period End' },
      '0,1': { slug: 'overtime-lineup', name: 'Start Overtime Lineup' },
      '1,1': { slug: 'clock-during-final-score', name: 'Show Clock During Final Score' }
    }
  },
  'period-end-timeout': {
    title: 'CRG Timeout Before Period End',
    keys: {
      '0,0': { slug: 'back', name: 'Back', settings: { page: 'end-of-period' } },
      '1,0': { slug: 'period-end-seconds', name: 'Seconds at Timeout' },
      '2,0': { slug: 'start-period-end-timeout', name: 'Start Timeout' },
      '1,1': { slug: 'period-end-seconds-down', name: 'Minus 1 Second' },
      '2,1': { slug: 'period-end-seconds-up', name: 'Plus 1 Second' }
    }
  }
};

const EMPTY = Buffer.alloc(0);

/** Unix permissions for the zip entries, as Stream Deck's own exports carry them. */
const DIRECTORY_ATTRIBUTES = ((0o40755 << 16) | 0x10) >>> 0;

const FILE_ATTRIBUTES = (0o100644 << 16) >>> 0;

/** A UUID derived from a name, so a page keeps its identity from one build to the next. */
function stableUuid(name) {
  const hash = createHash('sha1').update(`${PLUGIN_UUID}/${name}`).digest();

  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.subarray(0, 16).toString('hex');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** A zip archive of uncompressed entries, which is what a .streamDeckProfile file is. */
function zip(entries) {
  const date = (1 << 5) | 1;
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const path = Buffer.from(name, 'utf8');
    const checksum = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    const central = Buffer.alloc(46);

    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(path.length, 26);

    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(path.length, 28);
    central.writeUInt32LE(name.endsWith('/') ? DIRECTORY_ATTRIBUTES : FILE_ATTRIBUTES, 38);
    central.writeUInt32LE(offset, 42);

    parts.push(local, path, data);
    directory.push(central, path);
    offset += local.length + path.length + data.length;
  }

  const size = directory.reduce((total, part) => total + part.length, 0);
  const end = Buffer.alloc(22);

  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, ...directory, end]);
}

/** One key on a page, in the form Stream Deck 7.4 stores it. */
function keyEntry(key, actionId, version) {
  return {
    ActionID: actionId,
    LinkedTitle: true,
    Name: key.name,
    Plugin: { Name: 'CRG Scoreboard', UUID: PLUGIN_UUID, Version: version },
    Resources: null,
    Settings: key.settings ?? {},
    State: 0,
    States: [
      {
        FontFamily: '',
        FontSize: 12,
        FontStyle: '',
        FontUnderline: false,
        OutlineThickness: 2,
        ShowTitle: false,
        TitleAlignment: 'middle',
        TitleColor: '#ffffff'
      }
    ],
    UUID: `${PLUGIN_UUID}.${key.slug}`
  };
}

/** A page's manifest: its keys, and an empty set of dials on a model that has them. */
function pageManifest(keys, device) {
  const controllers = [{ Actions: keys, Type: 'Keypad' }];

  if (device.encoders) {
    controllers.push({ Actions: {}, Type: 'Encoder' });
  }

  return { Controllers: controllers, Icon: '', Name: '' };
}

const json = (value) => Buffer.from(JSON.stringify(value));

/** The .streamDeckProfile bytes for one page on one model. */
function profileFile(pageName, page, device, version) {
  const id = `${pageName}/${device.name}`;
  const profile = stableUuid(`${id}/profile`).toUpperCase();
  const pageUuid = stableUuid(`${id}/page`);
  const defaultUuid = stableUuid(`${id}/default-page`);
  const root = `Profiles/${profile}.sdProfile/`;
  const pageFolder = `${root}Profiles/${pageUuid.toUpperCase()}/`;
  const defaultFolder = `${root}Profiles/${defaultUuid.toUpperCase()}/`;

  const keys = Object.fromEntries(
    Object.entries(page.keys).map(([position, key]) => [
      position,
      keyEntry(key, stableUuid(`${id}/key/${position}`), version)
    ])
  );

  const pkg = {
    AppVersion: APP_VERSION,
    DeviceModel: device.model,
    DeviceSettings: null,
    FormatVersion: 1,
    OSType: 'macOS',
    OSVersion: '15.0.0',
    RequiredPlugins: [PLUGIN_UUID]
  };

  const manifest = {
    Device: { Model: device.model, UUID: '' },
    Name: page.title,
    Pages: { Current: pageUuid, Default: defaultUuid, Pages: [pageUuid] },
    Version: '3.0'
  };

  return zip([
    { name: 'package.json', data: json(pkg) },
    { name: 'Profiles/', data: EMPTY },
    { name: root, data: EMPTY },
    { name: `${root}Images/`, data: EMPTY },
    { name: `${root}manifest.json`, data: json(manifest) },
    { name: `${root}Profiles/`, data: EMPTY },
    { name: defaultFolder, data: EMPTY },
    { name: `${defaultFolder}Images/`, data: EMPTY },
    { name: `${defaultFolder}manifest.json`, data: json(pageManifest({}, device)) },
    { name: pageFolder, data: EMPTY },
    { name: `${pageFolder}Images/`, data: EMPTY },
    { name: `${pageFolder}manifest.json`, data: json(pageManifest(keys, device)) }
  ]);
}

/** Writes every page file that changed, lists them all in the manifest, and reports whether anything changed. */
export async function buildProfiles() {
  const current = await readFile(MANIFEST_FILE, 'utf8');
  const manifest = JSON.parse(current);
  const listed = [];
  let changed = false;

  await mkdir(new URL('profiles/', PLUGIN), { recursive: true });

  for (const [pageName, page] of Object.entries(PAGES)) {
    for (const device of DEVICES) {
      const name = `profiles/${pageName}-${device.name}`;
      const file = new URL(`${name}.streamDeckProfile`, PLUGIN);
      const bytes = profileFile(pageName, page, device, manifest.Version);
      const existing = await readFile(file).catch(() => undefined);

      if (existing === undefined || !existing.equals(bytes)) {
        await writeFile(file, bytes);
        changed = true;
      }

      listed.push({
        Name: name,
        DeviceType: device.type,
        Readonly: true,
        DontAutoSwitchWhenInstalled: true,
        AutoInstall: false
      });
    }
  }

  manifest.Profiles = listed;

  const options = (await resolveConfig(MANIFEST_FILE)) ?? {};
  const updated = await format(JSON.stringify(manifest), { ...options, filepath: MANIFEST_FILE });

  if (updated !== current) {
    await writeFile(MANIFEST_FILE, updated);
    changed = true;
  }

  return changed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const changed = await buildProfiles();

  process.stdout.write(changed ? 'Wrote the page profiles\n' : 'Page profiles already match\n');
}
