/**
 * Where the CRG session is kept between runs.
 *
 * The session names this deck to CRG, and is held in a file only the
 * logged-on user account can read. Its contents are plain text, so it is
 * kept out of the plugin settings, which are handed whole to every
 * property inspector the plugin opens. The file sits in the user
 * account's application data folder, so it survives a plugin update and
 * CRG recognizes the Stream Deck as one device.
 */

import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';

import { pluginFilePath, writeWhole } from './local-files.ts';

/** The session CRG issued, and the scoreboard that issued it. */
export type StoredSession = {
  readonly session: string;
  readonly origin: string;
};

/** What the plugin settings need of a place to keep the session. */
export type SessionStore = {
  read: () => Promise<StoredSession | undefined>;
  write: (stored: StoredSession) => Promise<void>;
};

const FILE = 'session.json';

/** Where the session file sits on a platform, written with that platform's separators. */
export function sessionPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  return pluginFilePath(FILE, platform, env, home);
}

/** Reads a stored session out of the file's contents, and nothing from a file that holds anything else. */
export function readStored(contents: string): StoredSession | undefined {
  let held: unknown;

  try {
    held = JSON.parse(contents);
  } catch {
    return undefined;
  }

  if (typeof held !== 'object' || held === null) {
    return undefined;
  }

  const { session, origin } = held as { session?: unknown; origin?: unknown };

  if (typeof session !== 'string' || typeof origin !== 'string' || session === '' || origin === '') {
    return undefined;
  }

  return { session, origin };
}

export class SessionFile implements SessionStore {
  readonly #path: string;

  constructor(path: string = sessionPath()) {
    this.#path = path;
  }

  /** The stored session, or nothing when the file is missing or holds something else. */
  async read(): Promise<StoredSession | undefined> {
    try {
      return readStored(await readFile(this.#path, 'utf8'));
    } catch {
      return undefined;
    }
  }

  /** Writes the session whole, so a plugin stopped partway through never leaves half a file. */
  async write(stored: StoredSession): Promise<void> {
    await writeWhole(this.#path, `${JSON.stringify(stored, undefined, 2)}\n`);
  }
}
