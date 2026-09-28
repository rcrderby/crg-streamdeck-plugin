/**
 * Where the plugin keeps files of its own, outside Stream Deck's settings.
 *
 * They sit in the user account's application data folder, readable by
 * that account alone, so they survive a plugin update. Each is written
 * beside itself first and then moved into place, so a plugin stopped
 * partway through never leaves half a file.
 */

import { homedir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { mkdir, rename, writeFile } from 'node:fs/promises';

/** The folder the plugin keeps its own files in, named as the plugin is. */
const FOLDER = 'com.rcrderby.crg-streamdeck';

/** Readable and writable by this account alone. */
const FILE_MODE = 0o600;

const FOLDER_MODE = 0o700;

/** Where one of the plugin's files sits on a platform, written with that platform's separators. */
export function pluginFilePath(
  file: string,
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  if (platform === 'win32') {
    return win32.join(env['APPDATA'] ?? win32.join(home, 'AppData', 'Roaming'), FOLDER, file);
  }

  if (platform === 'darwin') {
    return posix.join(home, 'Library', 'Application Support', FOLDER, file);
  }

  return posix.join(env['XDG_STATE_HOME'] ?? posix.join(home, '.local', 'state'), FOLDER, file);
}

/** Writes a file whole, creating the folder the first time. */
export async function writeWhole(path: string, contents: string): Promise<void> {
  const partial = `${path}.partial`;

  await mkdir(join(path, '..'), { recursive: true, mode: FOLDER_MODE });
  await writeFile(partial, contents, { encoding: 'utf8', mode: FILE_MODE });
  await rename(partial, path);
}
