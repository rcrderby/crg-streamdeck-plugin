/**
 * Entry point.
 *
 * Registers the actions, connects to Stream Deck, then opens the CRG
 * connection from the global settings. Changing those settings in the
 * property inspector reconnects without a restart. While connected, the
 * computer is kept awake.
 */

import streamDeck from '@elgato/streamdeck';
import { setTimeout as delay } from 'node:timers/promises';

import { CrgClient, describeError } from './crg/client.ts';
import { OPERATOR_PREFIX, STREAM_DECK_OPERATOR, operatorNames, replaceOnUndo } from './crg/operators.ts';
import { OperatorChoice } from './operator-choice.ts';
import { PeriodEndSeconds } from './period-end-seconds.ts';
import { KeepAwake } from './system/keep-awake.ts';
import { keyActions } from './actions/registry.ts';
import { RenderScheduler } from './render/scheduler.ts';
import { PluginSettings, type GlobalSettings } from './plugin-settings.ts';
import { SessionFile } from './session-file.ts';
import { isOnline } from './actions/key-action.ts';
import { type PluginContext } from './context.ts';

/** How long the operator list is left to settle before the deck's own profile is created. */
const OPERATOR_SETTLE_MS = 1_000;

/** How long a stopping plugin waits for CRG to acknowledge the close. */
const SHUTDOWN_GRACE_MS = 1_000;

const logger = streamDeck.logger.createScope('plugin');

/** An error's message, whatever was thrown. */
function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

// A game is running, so an unexpected error is logged and the plugin
// carries on. Stream Deck's own handler logs only the first one, and
// with it gone the next would end the plugin.
process.on('uncaughtException', (cause) => logger.error(`Unexpected error: ${messageOf(cause)}`));
process.on('unhandledRejection', (cause) => logger.error(`Unhandled failure: ${messageOf(cause)}`));

const context: PluginContext = {
  client: new CrgClient(),
  scheduler: new RenderScheduler(undefined, undefined, (key, cause) =>
    logger.error(`Could not draw key ${key}: ${messageOf(cause)}`)
  ),
  connection: {
    connect: () => settings.setStopped(false),
    disconnect: () => settings.setStopped(true)
  },
  operator: new OperatorChoice(),
  periodEndSeconds: new PeriodEndSeconds()
};

const settings = new PluginSettings({
  store: streamDeck.settings,
  session: new SessionFile(),
  client: context.client,
  operator: context.operator,
  warn: (message) => logger.warn(message)
});

const keepAwake = new KeepAwake({
  platform: process.platform,
  pid: process.pid,
  onError: (cause) => logger.warn(`Could not keep this computer awake: ${cause.message}`)
});

/** The last failure logged, so a retry that fails the same way stays quiet. */
let lastFailure: string | undefined;

context.client.on('status', (status) => {
  logger.info(`CRG connection ${status}`);

  if (status === 'connected') {
    lastFailure = undefined;
  }
});

context.client.on('status', (status) => {
  if (!isOnline(status)) {
    keepAwake.release();

    return;
  }

  if (keepAwake.supported && !keepAwake.holding) {
    keepAwake.hold();
    logger.info(`Keeping this computer awake while connected to CRG${keepAwake.beta ? ' (beta on Windows)' : ''}`);
  }
});

context.client.on('unauthorized', (message) => {
  const device = context.client.deviceName ?? 'this device';

  logger.warn(`CRG refused a write: ${message}. Authorize '${device}' in CRG's client list.`);
});

context.client.on('error', (cause) => {
  const failure = describeError(cause);

  if (failure !== lastFailure) {
    lastFailure = failure;
    logger.warn(`CRG connection failed: ${failure}. Retrying until CRG answers.`);
  }
});

/**
 * Creates the deck's own profile in CRG, once the profiles have settled.
 *
 * CRG has no command for this: a profile exists as soon as one setting
 * is written under its name. The wait matters because a profile that has
 * not arrived yet would look missing, and writing would erase it.
 */
function createOwnOperator(): void {
  if (context.client.status !== 'connected' || operatorNames(context.client.state).includes(STREAM_DECK_OPERATOR)) {
    return;
  }

  logger.info(`Creating the ${STREAM_DECK_OPERATOR} operator profile in CRG`);
  context.client.set(replaceOnUndo(STREAM_DECK_OPERATOR), false);
}

/**
 * Lets the computer sleep again, closes the CRG connection, then exits.
 *
 * CRG drops a client that closes at once. One that vanishes stays in its
 * client list until the socket idles out five minutes later.
 */
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info(`Stopping on ${signal}`);
  keepAwake.release();
  await Promise.race([context.client.disconnect(), delay(SHUTDOWN_GRACE_MS)]);
  process.exit(0);
}

for (const keyAction of keyActions(context)) {
  streamDeck.actions.registerAction(keyAction);
}

// Any key press counts as activity, so the idle timer resets while an operator works the deck.
streamDeck.actions.onKeyDown(() => keepAwake.nudge());

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((event) => {
  settings.apply(event.settings);
});

let settling: NodeJS.Timeout | undefined;

/** Logs a settings write that failed, which would otherwise go unhandled. */
function reportSettingsFailure(cause: unknown): void {
  logger.warn(`Could not save the plugin settings: ${messageOf(cause)}`);
}

context.client.state.subscribePrefix(OPERATOR_PREFIX, () => {
  settings.rememberOperators(operatorNames(context.client.state)).catch(reportSettingsFailure);

  clearTimeout(settling);
  settling = setTimeout(createOwnOperator, OPERATOR_SETTLE_MS);
});

context.client.on('status', (status) => {
  if (status === 'connected') {
    settings.rememberSession().catch(reportSettingsFailure);
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown(signal));
}

await streamDeck.connect();

// The session is read before the first connection, so the deck offers
// CRG the identity it already has rather than asking for a new one.
await settings.load();

// The settings this returns also reach the listener above, which applies them.
await streamDeck.settings.getGlobalSettings<GlobalSettings>();
