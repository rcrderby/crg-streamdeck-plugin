/**
 * Whether the deck was disconnected on purpose, kept between runs.
 *
 * It lives in a file of the plugin's own rather than in Stream Deck's
 * settings, which every property inspector writes whole: one holding an
 * older copy could otherwise connect a deck someone had disconnected, or
 * the reverse. No property inspector reads it.
 */

import { readFile } from 'node:fs/promises';

import { pluginFilePath, writeWhole } from './local-files.ts';

/** What the plugin settings need of a place to keep the choice. */
export type StoppedStore = {
  read: () => Promise<boolean>;
  write: (stopped: boolean) => Promise<void>;
};

const FILE = 'connection.json';

/** Reads the choice out of the file's contents, and reads anything else as connected. */
export function readStopped(contents: string): boolean {
  try {
    const held: unknown = JSON.parse(contents);

    return typeof held === 'object' && held !== null && (held as { stopped?: unknown }).stopped === true;
  } catch {
    return false;
  }
}

export class ConnectionFile implements StoppedStore {
  readonly #path: string;

  constructor(path: string = pluginFilePath(FILE)) {
    this.#path = path;
  }

  /** True when the deck was disconnected on purpose; false when it was not, or the file is missing. */
  async read(): Promise<boolean> {
    try {
      return readStopped(await readFile(this.#path, 'utf8'));
    } catch {
      return false;
    }
  }

  async write(stopped: boolean): Promise<void> {
    await writeWhole(this.#path, `${JSON.stringify({ stopped }, undefined, 2)}\n`);
  }
}
