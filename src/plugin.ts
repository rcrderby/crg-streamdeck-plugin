/**
 * Entry point.
 *
 * Registers the actions, connects to Stream Deck, then opens the CRG
 * connection from the global settings. Changing those settings in the
 * property inspector reconnects without a restart.
 */

import streamDeck from '@elgato/streamdeck';
import { setTimeout as delay } from 'node:timers/promises';

import { Clock } from './actions/clock.ts';
import { Connection } from './actions/connection.ts';
import { CrgClient, describeError } from './crg/client.ts';
import { JamControl } from './actions/jam-control.ts';
import { RenderScheduler } from './render/scheduler.ts';
import { SettingsError, resolveConnection, type ConnectionSettings } from './crg/settings.ts';
import { TripPoints } from './actions/trip-points.ts';
import { type PluginContext } from './context.ts';

type GlobalSettings = ConnectionSettings & {
  /** The CRG cookies this device is known by, kept so it stays one device. */
  session?: string;
};

/** How long a stopping plugin waits for CRG to acknowledge the close. */
const SHUTDOWN_GRACE_MS = 1_000;

const logger = streamDeck.logger.createScope('plugin');

const context: PluginContext = {
  client: new CrgClient(),
  scheduler: new RenderScheduler()
};

/** The last failure logged, so a retry that fails the same way stays quiet. */
let lastFailure: string | undefined;

context.client.on('status', (status) => {
  logger.info(`CRG connection ${status}`);

  if (status === 'connected') {
    lastFailure = undefined;
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
 * Stores the session CRG issued.
 *
 * The cookies identify this device to CRG, so they are written to
 * settings and never to the log.
 */
async function rememberSession(): Promise<void> {
  const session = context.client.session;

  if (session === undefined) {
    return;
  }

  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

  if (settings.session !== session) {
    await streamDeck.settings.setGlobalSettings({ ...settings, session });
  }
}

/** Opens or re-points the CRG connection from the stored settings. */
function applySettings(settings: GlobalSettings): void {
  try {
    context.client.connect(resolveConnection(settings), settings.session);
  } catch (cause) {
    if (cause instanceof SettingsError) {
      logger.warn(`The CRG URL is not usable: ${cause.message}`);

      return;
    }

    throw cause;
  }
}

/**
 * Closes the CRG connection, then exits.
 *
 * CRG drops a client that closes at once. One that vanishes stays in its
 * client list until the socket idles out five minutes later.
 */
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info(`Stopping on ${signal}`);
  await Promise.race([context.client.disconnect(), delay(SHUTDOWN_GRACE_MS)]);
  process.exit(0);
}

streamDeck.actions.registerAction(new Connection(context));
streamDeck.actions.registerAction(new JamControl(context));
streamDeck.actions.registerAction(new Clock(context));
streamDeck.actions.registerAction(new TripPoints(context));

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((event) => {
  applySettings(event.settings);
});

context.client.on('status', (status) => {
  if (status === 'connected') {
    void rememberSession();
  }
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => void shutdown(signal));
}

await streamDeck.connect();

// The settings this returns also reach the listener above, which applies them.
await streamDeck.settings.getGlobalSettings<GlobalSettings>();
