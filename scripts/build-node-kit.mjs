// For installing the Stream Deck plugin without Internet access.
// This builds a folder that can be copied to a scoreboard computer
// to install the required NodeJS Stream Deck runtime.
//
//     node scripts/build-node-kit.mjs [version] [folder]
//
// Running this script requires Internet access; it downloads Windows and Mac
// runtimes from nodejs.org, halts unless each download matches the release's
// SHASUMS256.txt, and writes the install kit to a folder (dist/crg-node-kit-<version>)

import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  STREAM_DECK_NODE,
  checksums,
  isVersion,
  readShasums,
  releaseUrl,
  runtimes,
  sha256,
  verify
} from './node-kit/kit.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const INSTALLERS = fileURLToPath(new URL('node-kit/', import.meta.url));

const run = promisify(execFile);

/** Downloads one file from a release, as bytes. */
async function download(version, name) {
  const url = new URL(name, releaseUrl(version));
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/** The runtime's bytes: the file itself, or the one it names inside an archive. */
async function unpack(runtime, bytes, scratch) {
  if (!runtime.member) {
    return bytes;
  }

  const archive = join(scratch, runtime.source);

  await writeFile(archive, bytes);
  await run('tar', ['-xzf', archive, '-C', scratch, runtime.member]);

  return readFile(join(scratch, runtime.member));
}

/** Writes a file into the kit, creating its folder, with the given mode. */
async function place(kit, target, bytes, mode = 0o644) {
  const file = join(kit, target);

  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, bytes);
  await chmod(file, mode);
}

const version = process.argv[2] ?? STREAM_DECK_NODE;

if (!isVersion(version)) {
  console.error(`Not a Node.js release number: ${version}`);
  process.exit(1);
}

const kit = resolve(process.argv[3] ?? join(ROOT, 'dist', `crg-node-kit-${version}`));
const scratch = await mkdtemp(join(tmpdir(), 'crg-node-kit-'));

try {
  const shasums = await download(version, 'SHASUMS256.txt');
  const sums = readShasums(shasums.toString('utf8'));
  const entries = [];

  await rm(kit, { recursive: true, force: true });

  for (const runtime of runtimes(version)) {
    const bytes = await download(version, runtime.source);

    verify(runtime.source, bytes, sums);

    const binary = await unpack(runtime, bytes, scratch);
    const hash = sha256(binary);

    await place(kit, runtime.target, binary, 0o755);
    entries.push({ hash, target: runtime.target });
    console.log(`${hash}  ${runtime.target}  from ${runtime.source}`);
  }

  await place(kit, 'SHASUMS256.txt', shasums);
  await place(kit, 'SHASUMS256.txt.asc', await download(version, 'SHASUMS256.txt.asc'));
  await place(kit, 'CHECKSUMS.txt', checksums(entries));
  await place(kit, 'VERSION', `${version}\n`);

  const readme = await readFile(join(INSTALLERS, 'README.txt'), 'utf8');

  await place(kit, 'README.txt', readme.replaceAll('{{version}}', version));
  await copyFile(join(INSTALLERS, 'install.ps1'), join(kit, 'windows', 'install.ps1'));

  // cmd reads a batch file most reliably with Windows line endings
  const batch = await readFile(join(INSTALLERS, 'install.cmd'), 'utf8');

  await place(kit, 'windows/install.cmd', batch.replace(/\r?\n/g, '\r\n'));
  await place(kit, 'macos/install.command', await readFile(join(INSTALLERS, 'install.command')), 0o755);

  console.log(`\nWrote ${kit}`);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
