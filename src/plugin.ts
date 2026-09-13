/**
 * Entry point.
 *
 * Registers the actions, connects to Stream Deck, then opens the CRG
 * connection from the global settings. Changing those settings in the
 * property inspector reconnects without a restart.
 */

import streamDeck from '@elgato/streamdeck';

import { Clock } from './actions/clock.ts';
import { Connection } from './actions/connection.ts';
import { CrgClient } from './crg/client.ts';
import { JamControl } from './actions/jam-control.ts';
import { RenderScheduler } from './render/scheduler.ts';
import { SettingsError, resolveConnection, type ConnectionSettings } from './crg/settings.ts';
import { TripScore } from './actions/trip-score.ts';
import { type PluginContext } from './context.ts';

type GlobalSettings = ConnectionSettings & {
  /** The CRG cookies this device is known by, kept so it stays one device. */
  session?: string;
};

const logger = streamDeck.logger.createScope('plugin');

const context: PluginContext = {
  client: new CrgClient(),
  scheduler: new RenderScheduler()
};

context.client.on('status', (status) => {
  logger.info(`CRG connection ${status}`);
});

context.client.on('unauthorized', (message) => {
  const device = context.client.deviceName ?? 'this device';

  logger.warn(`CRG refused a write: ${message}. Authorize '${device}' in CRG's client list.`);
});

context.client.on('error', (cause) => {
  logger.error('CRG connection failed', cause);
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
async function applySettings(settings: GlobalSettings): Promise<void> {
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

streamDeck.actions.registerAction(new Connection(context));
streamDeck.actions.registerAction(new JamControl(context));
streamDeck.actions.registerAction(new Clock(context));
streamDeck.actions.registerAction(new TripScore(context));

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((event) => {
  void applySettings(event.settings);
});

context.client.on('status', (status) => {
  if (status === 'connected') {
    void rememberSession();
  }
});

await streamDeck.connect();

await applySettings(await streamDeck.settings.getGlobalSettings<GlobalSettings>());
