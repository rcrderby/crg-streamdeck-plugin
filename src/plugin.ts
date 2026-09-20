/**
 * Entry point.
 *
 * Registers the actions, connects to Stream Deck, then opens the CRG
 * connection from the global settings. Changing those settings in the
 * property inspector reconnects without a restart. While connected, the
 * computer is kept awake.
 */

import streamDeck from '@elgato/streamdeck';
import { CrgClient } from './crg/client.ts';
import { Runtime } from './runtime.ts';
import { OperatorChoice } from './operator-choice.ts';
import { PeriodEndSeconds } from './period-end-seconds.ts';
import { KeepAwake } from './system/keep-awake.ts';
import { keyActions } from './actions/registry.ts';
import { RenderScheduler } from './render/scheduler.ts';
import { PluginSettings, type GlobalSettings } from './plugin-settings.ts';
import { SessionFile } from './session-file.ts';
import { type PluginContext } from './context.ts';

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

const runtime = new Runtime({ client: context.client, keepAwake, settings, log: logger });

for (const keyAction of keyActions(context)) {
  streamDeck.actions.registerAction(keyAction);
}

// Any key press counts as activity, so the idle timer resets while an operator works the deck.
streamDeck.actions.onKeyDown(() => keepAwake.nudge());

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((event) => {
  settings.apply(event.settings);
});

runtime.start();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void runtime.stop(signal).then(() => process.exit(0));
  });
}

await streamDeck.connect();

// The session is read before the first connection, so the deck offers
// CRG the identity it already has rather than asking for a new one.
await settings.load();

// The settings this returns also reach the listener above, which applies them.
await streamDeck.settings.getGlobalSettings<GlobalSettings>();
