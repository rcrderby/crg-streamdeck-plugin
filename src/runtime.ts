/**
 * What the plugin does between CRG and Stream Deck, apart from starting up.
 *
 * The entry point builds the real client, settings, and keep awake helper
 * and hands them here. Everything below is decided by what it is given,
 * so a test can drive the whole of it without a deck, a scoreboard, or a
 * process to exit.
 */

import { setTimeout as delay } from 'node:timers/promises';

import { OPERATOR_PREFIX, STREAM_DECK_OPERATOR, operatorNames, replaceOnUndo } from './crg/operators.ts';
import { type CrgClient, type ConnectionStatus, describeError } from './crg/client.ts';
import { isOnline } from './actions/key-action.ts';

/** How long the operator list is left to settle before the deck's own profile is created. */
export const OPERATOR_SETTLE_MS = 1_000;

/** How long a stopping plugin waits for CRG to acknowledge the close. */
export const SHUTDOWN_GRACE_MS = 1_000;

/** The part of the log this needs, which Stream Deck's own logger answers. */
export type RuntimeLog = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

/** The part of the keep awake helper this drives. */
export type Awakener = {
  readonly supported: boolean;
  readonly beta: boolean;
  readonly holding: boolean;
  hold: () => void;
  release: () => void;
};

/** The part of the plugin settings this drives. */
export type RuntimeSettings = {
  rememberOperators: (names: readonly string[]) => Promise<void>;
  rememberSession: () => Promise<void>;
};

export type RuntimeParts = {
  readonly client: CrgClient;
  readonly keepAwake: Awakener;
  readonly settings: RuntimeSettings;
  readonly log: RuntimeLog;
  /** How long the operator list settles for, which a test shortens. */
  readonly operatorSettleMs?: number;
};

/** An error's message, whatever was thrown. */
function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export class Runtime {
  readonly #parts: RuntimeParts;

  /** The last failure logged, so a retry that fails the same way stays quiet. */
  #lastFailure: string | undefined;

  #settling: NodeJS.Timeout | undefined;

  constructor(parts: RuntimeParts) {
    this.#parts = parts;
  }

  /** Follows CRG: the log, the computer's sleep, the stored session, and the operator profiles. */
  start(): void {
    const { client } = this.#parts;

    client.on('status', (status) => this.#statusChanged(status));
    client.on('unauthorized', (message) => this.#refused(message));
    client.on('error', (cause) => this.#failed(cause));
    client.state.subscribePrefix(OPERATOR_PREFIX, () => this.#operatorsChanged());
  }

  /**
   * Lets the computer sleep again and closes the CRG connection.
   *
   * CRG drops a client that closes at once. One that vanishes stays in
   * its client list until the socket idles out five minutes later, so
   * the close is waited for, but only so long.
   */
  async stop(signal: string): Promise<void> {
    const { client, keepAwake, log } = this.#parts;

    log.info(`Stopping on ${signal}`);
    keepAwake.release();
    clearTimeout(this.#settling);

    await Promise.race([client.disconnect(), delay(SHUTDOWN_GRACE_MS)]);
  }

  #statusChanged(status: ConnectionStatus): void {
    const { keepAwake, log, settings } = this.#parts;

    log.info(`CRG connection ${status}`);

    if (status === 'connected') {
      this.#lastFailure = undefined;
      settings.rememberSession().catch((cause: unknown) => this.#settingsFailed(cause));
    }

    if (!isOnline(status)) {
      keepAwake.release();

      return;
    }

    if (keepAwake.supported && !keepAwake.holding) {
      keepAwake.hold();
      log.info(`Keeping this computer awake while connected to CRG${keepAwake.beta ? ' (beta on Windows)' : ''}`);
    }
  }

  #refused(message: string): void {
    const { client, log } = this.#parts;

    log.warn(
      `CRG refused a write: ${message}. Authorize '${client.deviceName ?? 'this device'}' in CRG's client list.`
    );
  }

  /** Reports a failure once, however many times the retries meet the same one. */
  #failed(cause: Error): void {
    const failure = describeError(cause);

    if (failure !== this.#lastFailure) {
      this.#lastFailure = failure;
      this.#parts.log.warn(`CRG connection failed: ${failure}. Retrying until CRG answers.`);
    }
  }

  #operatorsChanged(): void {
    const { client, settings } = this.#parts;

    settings.rememberOperators(operatorNames(client.state)).catch((cause: unknown) => this.#settingsFailed(cause));

    clearTimeout(this.#settling);
    this.#settling = setTimeout(() => this.#createOwnOperator(), this.#parts.operatorSettleMs ?? OPERATOR_SETTLE_MS);
  }

  /**
   * Creates the deck's own profile in CRG, once the profiles have settled.
   *
   * CRG has no command for this: a profile exists as soon as one setting
   * is written under its name. The wait matters because a profile that
   * has not arrived yet would look missing, and writing would erase it.
   */
  #createOwnOperator(): void {
    const { client, log } = this.#parts;

    if (client.status !== 'connected' || operatorNames(client.state).includes(STREAM_DECK_OPERATOR)) {
      return;
    }

    log.info(`Creating the ${STREAM_DECK_OPERATOR} operator profile in CRG`);
    client.set(replaceOnUndo(STREAM_DECK_OPERATOR), false);
  }

  /** Logs a settings write that failed, which would otherwise go unhandled. */
  #settingsFailed(cause: unknown): void {
    this.#parts.log.warn(`Could not save the plugin settings: ${messageOf(cause)}`);
  }
}
