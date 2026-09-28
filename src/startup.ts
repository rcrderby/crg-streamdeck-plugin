/**
 * Runs the steps that start the plugin, in order, and ends the process
 * when any step fails.
 *
 * Once started, the plugin continues through errors, since a game might
 * be in progress. A plugin that never starts leaves every key unusable.
 */

import { messageOf } from './errors.ts';

/** One step of starting, named for the log. */
export type StartupStep = {
  readonly name: string;
  readonly run: () => Promise<unknown>;
};

export type StartupLog = {
  error: (message: string) => void;
};

/** What starting needs, which plugin.ts supplies from Stream Deck and a test supplies from stand-ins. */
export type StartupParts<T> = {
  readonly connect: () => Promise<unknown>;
  readonly loadSession: () => Promise<void>;
  readonly readSettings: () => Promise<T>;
  readonly applySettings: (settings: T) => void;
};

/**
 * The steps that start the plugin, in order.
 *
 * The session is read before the first connection, so the deck offers
 * CRG the identity it already has. The settings read at startup are
 * applied here, since Stream Deck tells the plugin's settings listener
 * only about changes made in a property inspector.
 */
export function startupSteps<T>(parts: StartupParts<T>): StartupStep[] {
  return [
    { name: 'Connecting to Stream Deck', run: () => parts.connect() },
    { name: 'Reading the stored CRG session', run: () => parts.loadSession() },
    { name: 'Reading the plugin settings', run: async () => parts.applySettings(await parts.readSettings()) }
  ];
}

/**
 * Runs each step after the last, and exits with status 1 at the first
 * that fails, after logging which step it was and why.
 *
 * Returns whether every step finished, for a caller whose exit returns.
 */
export async function runStartup(
  steps: readonly StartupStep[],
  log: StartupLog,
  exit: (code: number) => void = (code) => process.exit(code)
): Promise<boolean> {
  for (const step of steps) {
    try {
      await step.run();
    } catch (cause) {
      log.error(`Could not start: ${step.name} failed: ${messageOf(cause)}`);
      exit(1);

      return false;
    }
  }

  return true;
}
