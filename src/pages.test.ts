import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { PAGES, PAGE_DEVICES, pageProfile } from './pages.ts';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

type ManifestProfile = { Name: string; DeviceType: number; Readonly?: boolean; AutoInstall?: boolean };

const manifest = JSON.parse(readFileSync(new URL('manifest.json', PLUGIN), 'utf8')) as {
  Profiles?: ManifestProfile[];
  Actions: { UUID: string; VisibleInActionsList?: boolean }[];
};

const PAGE_KEYS: Readonly<Record<string, readonly string[]>> = {
  connection: ['back', 'connection-toggle'],
  undo: ['replace-info', 'replace-confirm', 'replace-choice', 'back'],
  automation: ['back', 'auto-end-jams', 'auto-end-team-timeouts'],
  'end-of-period': ['back', 'official-score', 'period-end-timeout', 'overtime-lineup', 'clock-during-final-score'],
  'period-end-timeout': [
    'back',
    'period-end-seconds',
    'start-period-end-timeout',
    'period-end-seconds-down',
    'period-end-seconds-up'
  ]
};

type Named = { Name?: string | undefined };

const byName = (a: Named, b: Named): number => (a.Name ?? '').localeCompare(b.Name ?? '');

describe('pages', () => {
  it('ship for every keypad model, including the six key virtual Stream Deck', () => {
    assert.deepEqual(
      Object.keys(PAGE_DEVICES)
        .map(Number)
        .sort((a, b) => a - b),
      [0, 1, 2, 3, 7, 9, 10, 11, 13]
    );
  });

  it('name no page for a model without one', () => {
    assert.equal(pageProfile('undo', 5), undefined);
    assert.equal(pageProfile('connection', 2), 'profiles/connection-xl');
  });

  it('are listed in the manifest, one read-only file per page and model', () => {
    const expected = PAGES.flatMap((page) =>
      Object.keys(PAGE_DEVICES).map((type) => ({ Name: pageProfile(page, Number(type)), DeviceType: Number(type) }))
    );
    const listed = (manifest.Profiles ?? []).map(({ Name, DeviceType }) => ({ Name, DeviceType }));

    assert.deepEqual(listed.sort(byName), expected.sort(byName));
    assert.ok((manifest.Profiles ?? []).every((profile) => profile.Readonly === true && profile.AutoInstall === false));
  });

  it('each hold the page’s keys', () => {
    for (const profile of manifest.Profiles ?? []) {
      const bytes = readFileSync(new URL(`${profile.Name}.streamDeckProfile`, PLUGIN));
      const page = PAGES.find((candidate) => profile.Name.startsWith(`profiles/${candidate}-`)) ?? '';

      assert.equal(bytes.subarray(0, 4).toString('hex'), '504b0304', profile.Name);

      for (const key of PAGE_KEYS[page] ?? []) {
        assert.ok(bytes.includes(`"com.rcrderby.crg-streamdeck.${key}"`), `${profile.Name}: ${key}`);
      }
    }
  });

  it('cover every page the plugin ships', () => {
    assert.deepEqual(Object.keys(PAGE_KEYS).sort(), [...PAGES].sort());
  });

  it('use keys hidden from the actions list', () => {
    for (const key of Object.values(PAGE_KEYS).flat()) {
      const action = manifest.Actions.find((candidate) => candidate.UUID === `com.rcrderby.crg-streamdeck.${key}`);

      assert.equal(action?.VisibleInActionsList, false, key);
    }
  });
});
