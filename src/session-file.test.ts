import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises';
import { after, describe, it } from 'node:test';
import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { SessionFile, readStored, sessionPath } from './session-file.ts';

const FOLDER = 'com.rcrderby.crg-streamdeck';

const folders: string[] = [];

/** A folder of its own for one test, removed once they have all run. */
async function scratch(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), 'crg-session-'));

  folders.push(folder);

  return folder;
}

after(async () => {
  for (const folder of folders) {
    await rm(folder, { recursive: true, force: true });
  }
});

describe('sessionPath', () => {
  it('keeps the file in the account’s own application data on macOS', () => {
    assert.equal(
      sessionPath('darwin', {}, '/Users/tim'),
      `/Users/tim/Library/Application Support/${FOLDER}/session.json`
    );
  });

  it('follows APPDATA on Windows, and falls back to its usual place', () => {
    const roaming = 'C:\\Users\\tim\\AppData\\Roaming';

    assert.equal(sessionPath('win32', { APPDATA: roaming }, 'C:\\Users\\tim'), join(roaming, FOLDER, 'session.json'));
    assert.equal(
      sessionPath('win32', {}, 'C:\\Users\\tim'),
      join('C:\\Users\\tim', 'AppData', 'Roaming', FOLDER, 'session.json')
    );
  });

  it('follows the state folder elsewhere, as a development container is', () => {
    assert.equal(
      sessionPath('linux', { XDG_STATE_HOME: '/home/tim/.state' }, '/home/tim'),
      `/home/tim/.state/${FOLDER}/session.json`
    );
    assert.equal(sessionPath('linux', {}, '/home/tim'), `/home/tim/.local/state/${FOLDER}/session.json`);
  });
});

describe('readStored', () => {
  it('reads a session and the scoreboard it belongs to', () => {
    assert.deepEqual(readStored('{"session":"CRG_SCOREBOARD=abc","origin":"http://localhost:8000"}'), {
      session: 'CRG_SCOREBOARD=abc',
      origin: 'http://localhost:8000'
    });
  });

  it('reads nothing from a file holding anything else', () => {
    for (const contents of ['', 'not json', 'null', '[]', '{"session":"abc"}', '{"session":"","origin":"http://a"}']) {
      assert.equal(readStored(contents), undefined, contents);
    }
  });
});

describe('SessionFile', () => {
  it('writes a session and reads it back', async () => {
    const file = new SessionFile(join(await scratch(), 'data', 'session.json'));
    const stored = { session: 'CRG_SCOREBOARD=abc', origin: 'http://localhost:8000' };

    await file.write(stored);

    assert.deepEqual(await file.read(), stored);
  });

  it('keeps the file to this account, since the session is what CRG knows the deck by', async () => {
    const path = join(await scratch(), 'session.json');
    const file = new SessionFile(path);

    await file.write({ session: 'CRG_SCOREBOARD=abc', origin: 'http://localhost:8000' });

    assert.equal((await stat(path)).mode & 0o777, 0o600);
  });

  it('reads nothing when the file is missing or holds something else', async () => {
    const folder = await scratch();
    const missing = new SessionFile(join(folder, 'missing.json'));
    const path = join(folder, 'rubbish.json');

    await writeFile(path, 'not json');

    assert.equal(await missing.read(), undefined);
    assert.equal(await new SessionFile(path).read(), undefined);
  });

  it('replaces what it held, so a new session does not sit behind the old one', async () => {
    const path = join(await scratch(), 'session.json');
    const file = new SessionFile(path);

    await file.write({ session: 'CRG_SCOREBOARD=old', origin: 'http://localhost:8000' });
    await file.write({ session: 'CRG_SCOREBOARD=new', origin: 'http://scoreboard:8000' });

    assert.deepEqual(await file.read(), { session: 'CRG_SCOREBOARD=new', origin: 'http://scoreboard:8000' });
    assert.doesNotMatch(await readFile(path, 'utf8'), /old/);
  });
});
