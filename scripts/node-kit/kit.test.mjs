import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { checksums, isVersion, readShasums, releaseUrl, runtimes, sha256, verify } from './kit.mjs';

const EXE = Buffer.from('a Windows runtime');
const ARCHIVE = Buffer.from('a Mac archive');

const SHASUMS = [
  `${sha256(ARCHIVE)}  node-v24.13.1-darwin-arm64.tar.gz`,
  `${sha256(EXE)}  win-x64/node.exe`,
  'not a line of hashes',
  ''
].join('\n');

describe('the offline Node.js kit', () => {
  it('carries a runtime for each system and processor', () => {
    assert.deepEqual(
      runtimes('24.13.1').map(({ target }) => target),
      ['windows/x64/node.exe', 'windows/arm64/node.exe', 'macos/arm64/node', 'macos/x64/node']
    );
  });

  it('names each runtime as nodejs.org lists it', () => {
    const [windows, , mac] = runtimes('24.13.1');

    assert.equal(windows.source, 'win-x64/node.exe');
    assert.equal(mac.source, 'node-v24.13.1-darwin-arm64.tar.gz');
    assert.equal(mac.member, 'node-v24.13.1-darwin-arm64/bin/node');
    assert.equal(releaseUrl('24.13.1'), 'https://nodejs.org/dist/v24.13.1/');
  });

  it('accepts only a release number', () => {
    assert.equal(isVersion('24.13.1'), true);
    assert.equal(isVersion('v24.13.1'), false);
    assert.equal(isVersion('24'), false);
    assert.equal(isVersion('24.13.1/../x'), false);
  });

  it('reads the hashes nodejs.org publishes, and skips anything else', () => {
    const sums = readShasums(SHASUMS.replaceAll('\n', '\r\n'));

    assert.equal(sums.size, 2);
    assert.equal(sums.get('win-x64/node.exe'), sha256(EXE));
  });

  it('passes a download that matches its hash', () => {
    assert.equal(verify('win-x64/node.exe', EXE, readShasums(SHASUMS)), sha256(EXE));
  });

  it('stops on a download that does not match', () => {
    assert.throws(() => verify('win-x64/node.exe', Buffer.from('tampered'), readShasums(SHASUMS)), /does not match/);
  });

  it('stops on a file nodejs.org does not list', () => {
    assert.throws(() => verify('win-arm64/node.exe', EXE, readShasums(SHASUMS)), /not in SHASUMS256/);
  });

  it('lists the kit’s runtimes in the format shasum checks', () => {
    const text = checksums([
      { hash: 'b'.repeat(64), target: 'windows/x64/node.exe' },
      { hash: 'a'.repeat(64), target: 'macos/arm64/node' }
    ]);

    assert.equal(text, `${'a'.repeat(64)}  macos/arm64/node\n${'b'.repeat(64)}  windows/x64/node.exe\n`);
  });
});
