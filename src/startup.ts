/**
 * Runs the steps that start the plugin, in order, and ends the process
 * when any step fails.
 *
 * Once started, the plugin continues through errors, since a game might
 * be in progress. A plugin that never starts leaves every key unusable.
 */

/** One step of starting, named for the log. */
export type StartupStep = {
  readonly name: string;
  readonly run: () => Promise<unknown>;
};

export type StartupLog = {
  error: (message: string) => void;
};

/** An error's message, whatever was thrown. */
function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
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
