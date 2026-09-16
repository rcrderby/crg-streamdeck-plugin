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

import { ActiveClock } from './actions/active-clock.ts';
import { AddTrip, RemoveTrip, Score, TripPointsDown, TripPointsUp } from './actions/scoring.ts';
import { Back, ConnectionToggle } from './actions/connection-page.ts';
import { Clock } from './actions/clock.ts';
import { Connection } from './actions/connection.ts';
import { ReplaceChoice, ReplaceConfirm, ReplaceInfo } from './actions/replace-page.ts';
import { CrgClient, describeError } from './crg/client.ts';
import { OPERATOR_PREFIX, STREAM_DECK_OPERATOR, operatorNames, replaceOnUndo } from './crg/operators.ts';
import { OperatorChoice } from './operator-choice.ts';
import { Injury, Lead, LostLead, NoInitial, NoPivot, StarPass } from './actions/team-flags.ts';
import { JamControl } from './actions/jam-control.ts';
import { KeepAwake } from './system/keep-awake.ts';
import { OfficialReview, TeamTimeout } from './actions/team-resources.ts';
import { OfficialTimeout, Timeout, Undo } from './actions/game-controls.ts';
import { RenderScheduler } from './render/scheduler.ts';
import { SettingsError, resolveConnection, type ConnectionSettings } from './crg/settings.ts';
import { TripPoints } from './actions/trip-points.ts';
import { isOnline } from './actions/key-action.ts';
import { type PluginContext } from './context.ts';

type GlobalSettings = ConnectionSettings & {
  /** The CRG cookies this device is known by, kept so it stays one device. */
  session?: string;
  /** True once the deck is disconnected on purpose, until it is connected again. */
  stopped?: boolean;
  /** The CRG operator profile the deck keeps its settings under. */
  operator?: string;
  /** The profiles CRG holds, kept here because a property inspector cannot read CRG itself. */
  operators?: string[];
};

/** How long the operator list is left to settle before the deck's own profile is created. */
const OPERATOR_SETTLE_MS = 1_000;

/** How long a stopping plugin waits for CRG to acknowledge the close. */
const SHUTDOWN_GRACE_MS = 1_000;

const logger = streamDeck.logger.createScope('plugin');

const context: PluginContext = {
  client: new CrgClient(),
  scheduler: new RenderScheduler(),
  connection: {
    connect: () => setStopped(false),
    disconnect: () => setStopped(true)
  },
  operator: new OperatorChoice()
};

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

/**
 * Keeps the operator profiles CRG holds where a property inspector can read them.
 *
 * A property inspector sees only the plugin's settings, never CRG, so
 * the list is copied into them whenever it changes.
 */
async function rememberOperators(): Promise<void> {
  const names = operatorNames(context.client.state);

  if (names.length === 0) {
    return;
  }

  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();

  if ((settings.operators ?? []).join('\u0000') !== names.join('\u0000')) {
    await streamDeck.settings.setGlobalSettings({ ...settings, operators: names });
  }
}

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

/** Opens or re-points the CRG connection from the stored settings, unless the deck was disconnected on purpose. */
function applySettings(settings: GlobalSettings): void {
  context.operator.set(settings.operator);

  if (settings.stopped === true) {
    void context.client.stop();

    return;
  }

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
 * Connects or disconnects on purpose, and remembers the choice.
 *
 * A deck disconnected on purpose stays disconnected across restarts
 * until someone connects it again.
 */
async function setStopped(stopped: boolean): Promise<void> {
  const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
  const next: GlobalSettings = { ...settings, stopped };

  await streamDeck.settings.setGlobalSettings(next);
  applySettings(next);
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

for (const keyAction of [
  new Connection(context),
  new JamControl(context),
  new Timeout(context),
  new OfficialTimeout(context),
  new Undo(context),
  new Clock(context),
  new ActiveClock(context),
  new Lead(context),
  new LostLead(context),
  new StarPass(context),
  new NoPivot(context),
  new NoInitial(context),
  new Injury(context),
  new TeamTimeout(context),
  new OfficialReview(context),
  new TripPoints(context),
  new TripPointsUp(context),
  new TripPointsDown(context),
  new AddTrip(context),
  new RemoveTrip(context),
  new Score(context),
  new Back(context),
  new ConnectionToggle(context),
  new ReplaceInfo(context),
  new ReplaceConfirm(context),
  new ReplaceChoice(context)
]) {
  streamDeck.actions.registerAction(keyAction);
}

// Any key press counts as activity, so the idle timer resets while an operator works the deck.
streamDeck.actions.onKeyDown(() => keepAwake.nudge());

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((event) => {
  applySettings(event.settings);
});

let settling: NodeJS.Timeout | undefined;

context.client.state.subscribePrefix(OPERATOR_PREFIX, () => {
  void rememberOperators();

  clearTimeout(settling);
  settling = setTimeout(createOwnOperator, OPERATOR_SETTLE_MS);
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
