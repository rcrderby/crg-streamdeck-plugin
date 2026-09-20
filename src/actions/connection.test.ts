import assert from 'node:assert/strict';
import streamDeck from '@elgato/streamdeck';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { FakeDeck, PEDAL, XL } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import { Connection } from './connection.ts';
import { ConnectionToggle } from './connection-page.ts';
import { OPERATOR_SOURCE } from './operator-messages.ts';
import { replaceOnUndo } from '../crg/operators.ts';

describe('the CRG Connection key', () => {
  let deck: FakeDeck;
  let keyAction: Connection;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new Connection(deck.context);
  });

  afterEach(() => deck.stop());

  it('opens the connection page', async () => {
    await deck.press(keyAction, deck.place(keyAction, {}, XL));

    assert.deepEqual(deck.switched, [{ deviceId: 'device-1', profile: 'profiles/connection-xl' }]);
  });

  it('reconnects on a model with no page', async () => {
    const reconnect = mock.method(deck.client, 'reconnect', () => undefined);

    await deck.press(keyAction, deck.place(keyAction, {}, PEDAL));

    assert.equal(reconnect.mock.callCount(), 1);
    assert.deepEqual(deck.switched, []);
  });

  it('connects a deck disconnected on purpose, on a model with no page', async () => {
    const connect = mock.method(deck.connection, 'connect');

    deck.client.say('stopped');
    await deck.press(keyAction, deck.place(keyAction, {}, PEDAL));

    assert.equal(connect.mock.callCount(), 1);
  });

  it('stays readable while disconnected, since it says what is wrong', () => {
    const key = deck.place(keyAction);

    deck.client.say('disconnected');
    deck.draw();

    assert.ok(
      !Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64')
        .toString('utf8')
        .includes('opacity="0.62"')
    );
  });

  it('answers a property inspector asking for the operator profiles', async () => {
    const sent: unknown[] = [];

    Object.defineProperty(streamDeck, 'ui', {
      configurable: true,
      value: { sendToPropertyInspector: (message: unknown) => Promise.resolve(void sent.push(message)) }
    });
    deck.hold({ [replaceOnUndo('Wheels')]: true });

    await keyAction.onSendToPlugin?.({ payload: { event: OPERATOR_SOURCE } } as never);

    // The deck's own profile leads the list until CRG lists it too.
    assert.deepEqual(sent, [
      {
        event: OPERATOR_SOURCE,
        items: [
          { label: 'StreamDeck', value: 'StreamDeck' },
          { label: 'Wheels', value: 'Wheels' }
        ]
      }
    ]);
  });
});

describe('the connection page toggle', () => {
  let deck: FakeDeck;
  let keyAction: ConnectionToggle;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new ConnectionToggle(deck.context);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  /** Holds the key for the full second. */
  async function holdFully(): Promise<void> {
    const key = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
  }

  it('disconnects once held while connected', async () => {
    const disconnect = mock.method(deck.connection, 'disconnect');
    const connect = mock.method(deck.connection, 'connect');

    await holdFully();

    assert.equal(disconnect.mock.callCount(), 1);
    assert.equal(connect.mock.callCount(), 0);
  });

  it('connects once held while disconnected on purpose', async () => {
    const disconnect = mock.method(deck.connection, 'disconnect');
    const connect = mock.method(deck.connection, 'connect');

    deck.client.say('stopped');
    await holdFully();

    assert.equal(connect.mock.callCount(), 1);
    assert.equal(disconnect.mock.callCount(), 0);
  });

  it('does nothing on a quick press', async () => {
    const disconnect = mock.method(deck.connection, 'disconnect');

    await deck.press(keyAction, deck.place(keyAction));
    mock.timers.tick(HOLD_MS);

    assert.equal(disconnect.mock.callCount(), 0);
  });
});
