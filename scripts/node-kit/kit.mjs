// What goes into the offline Node.js kit, and how its downloads are checked.
//
// Stream Deck downloads the Node.js runtime the plugin needs the first
// time it starts. The kit carries the runtime for a machine that has
// no Internet, taken from nodejs.org and checked against the list of
// hashes nodejs.org publishes with each release.

import { createHash } from 'node:crypto';

/** The Node.js release Stream Deck 7.6 runs plugins on. */
export const STREAM_DECK_NODE = '24.13.1';

/** Where nodejs.org publishes a release. */
export function releaseUrl(version) {
  return `https://nodejs.org/dist/v${version}/`;
}

/** True for a release number such as 24.13.1. */
export function isVersion(value) {
  return /^\d+\.\d+\.\d+$/.test(value);
}

/**
 * The runtimes the kit carries, one per system and processor.
 *
 * `source` is the file's name in the release's list of hashes. A Mac
 * runtime comes inside an archive, so `member` names the file within it.
 */
export function runtimes(version) {
  const mac = (arch) => ({
    system: 'macos',
    arch,
    source: `node-v${version}-darwin-${arch}.tar.gz`,
    member: `node-v${version}-darwin-${arch}/bin/node`,
    target: `macos/${arch}/node`
  });
  const windows = (arch) => ({
    system: 'windows',
    arch,
    source: `win-${arch}/node.exe`,
    target: `windows/${arch}/node.exe`
  });

  return [windows('x64'), windows('arm64'), mac('arm64'), mac('x64')];
}

/** The sha256 of some bytes, as lowercase hex. */
export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Reads a SHASUMS256.txt into a map of file name to hash. */
export function readShasums(text) {
  const sums = new Map();

  for (const line of text.split(/\r?\n/)) {
    const match = /^([0-9a-f]{64}) {2}(\S+)$/.exec(line.trim());

    if (match) {
      sums.set(match[2], match[1]);
    }
  }

  return sums;
}

/**
 * Throws an exception unless the bytes are the file nodejs.org
 * lists under that name.
 * */
export function verify(name, bytes, sums) {
  const expected = sums.get(name);

  if (!expected) {
    throw new Error(`${name} is not in SHASUMS256.txt`);
  }

  const actual = sha256(bytes);

  if (actual !== expected) {
    throw new Error(`${name} does not match SHASUMS256.txt: expected ${expected}, got ${actual}`);
  }

  return actual;
}

/** The kit's CHECKSUMS.txt, in the format shasum and sha256sum check. */
export function checksums(entries) {
  return (
    [...entries]
      .sort((a, b) => a.target.localeCompare(b.target))
      .map(({ hash, target }) => `${hash}  ${target}`)
      .join('\n') + '\n'
  );
}
