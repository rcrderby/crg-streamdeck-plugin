import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { after, describe, it } from 'node:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { ConnectionFile, readStopped } from './connection-file.ts';
import { pluginFilePath } from './local-files.ts';

/** Windows keeps no POSIX file modes, so the account's own folder is what protects the file there. */
const noModes = process.platform === 'win32' && 'Windows has no POSIX file modes';

const folders: string[] = [];

async function scratch(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'crg-connection-'));

  folders.push(folder);

  return folder;
}

after(async () => {
  for (const folder of folders) {
    await rm(folder, { recursive: true, force: true });
  }
});

describe('readStopped', () => {
  it('reads a deck disconnected on purpose, and anything else as connected', () => {
    assert.equal(readStopped('{"stopped":true}'), true);

    for (const contents of ['{"stopped":false}', '{"stopped":"true"}', '', 'not json', 'null', '[]']) {
      assert.equal(readStopped(contents), false, contents);
    }
  });
});

describe('ConnectionFile', () => {
  it('keeps the choice beside the session, in the plugin\u2019s own folder', () => {
    assert.equal(
      pluginFilePath('connection.json', 'darwin', {}, '/Users/tim'),
      '/Users/tim/Library/Application Support/com.rcrderby.crg-streamdeck/connection.json'
    );
  });

  it('writes the choice and reads it back, and reads a missing file as connected', async () => {
    const folder = await scratch();
    const file = new ConnectionFile(join(folder, 'data', 'connection.json'));

    assert.equal(await file.read(), false);

    await file.write(true);

    assert.equal(await file.read(), true);

    await file.write(false);

    assert.equal(await file.read(), false);
    assert.deepEqual(await readdir(join(folder, 'data')), ['connection.json']);
  });

  it('keeps the file to this account', { skip: noModes }, async () => {
    const path = join(await scratch(), 'connection.json');

    await new ConnectionFile(path).write(true);

    assert.equal((await stat(path)).mode & 0o777, 0o600);
  });
});
