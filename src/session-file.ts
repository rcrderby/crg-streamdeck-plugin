/**
 * Where the CRG session is kept between runs.
 *
 * The session names this deck to CRG, and held in a file only the logged-
 * on user account can read.  Session file contents are are plain text and
 * are handed whole to every property inspector the * plugin opens.
 * The file sits in user account's application data, so it survives a plugin
 * update and CRG recognizes the Stream Deck as one device.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

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

/** The folder the plugin keeps its own data in, named as the plugin is. */
const FOLDER = 'com.rcrderby.crg-streamdeck';

const FILE = 'session.json';

/** Readable and writable by this account alone, since the session is what CRG knows the deck by. */
const FILE_MODE = 0o600;

const FOLDER_MODE = 0o700;

/** Where the session file sits on this platform. */
export function sessionPath(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir()
): string {
  if (platform === 'win32') {
    return join(env['APPDATA'] ?? join(home, 'AppData', 'Roaming'), FOLDER, FILE);
  }

  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support', FOLDER, FILE);
  }

  return join(env['XDG_STATE_HOME'] ?? join(home, '.local', 'state'), FOLDER, FILE);
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

  /** Writes the session, creating the folder the first time. */
  async write(stored: StoredSession): Promise<void> {
    await mkdir(join(this.#path, '..'), { recursive: true, mode: FOLDER_MODE });
    await writeFile(this.#path, `${JSON.stringify(stored, undefined, 2)}\n`, { encoding: 'utf8', mode: FILE_MODE });
  }
}
