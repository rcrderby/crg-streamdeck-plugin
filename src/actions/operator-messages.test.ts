import streamDeck from '@elgato/streamdeck';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck } from '../test-support/fake-deck.ts';
import { OPERATOR_SOURCE, answerOperatorMessage } from './operator-messages.ts';
import { replaceOnUndo } from '../crg/operators.ts';

/** Asks the plugin something, as a property inspector does. */
function ask(deck: FakeDeck, payload: unknown): Promise<void> {
  return answerOperatorMessage(deck.context, { payload } as never);
}

describe('the operator messages a property inspector sends', () => {
  let deck: FakeDeck;
  let sent: unknown[];

  beforeEach(() => {
    deck = new FakeDeck();
    sent = [];
    Object.defineProperty(streamDeck, 'ui', {
      configurable: true,
      value: { sendToPropertyInspector: (message: unknown) => Promise.resolve(void sent.push(message)) }
    });
  });

  afterEach(() => deck.stop());

  it('lists the profiles CRG holds, with the one in use first until CRG lists it', async () => {
    deck.hold({ [replaceOnUndo('Wheels')]: true, [replaceOnUndo('default')]: false });

    await ask(deck, { event: OPERATOR_SOURCE });

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

  it('makes a new profile under the name CRG will store', async () => {
    await ask(deck, { event: 'createOperator', name: ' Rose City ' });

    assert.deepEqual(deck.written, [{ key: replaceOnUndo('Rose_City'), value: false, flag: '' }]);
  });

  it('leaves a profile CRG already holds alone, whatever the inspector believed', async () => {
    deck.hold({ [replaceOnUndo('Wheels')]: true });

    await ask(deck, { event: 'createOperator', name: 'Wheels' });

    assert.deepEqual(deck.written, []);
  });

  it('ignores a blank name, and anything it does not recognize', async () => {
    await ask(deck, { event: 'createOperator', name: '   ' });
    await ask(deck, { event: 'createOperator', name: 42 });
    await ask(deck, { event: 'somethingElse' });
    await ask(deck, 'not an object');

    assert.deepEqual(deck.written, []);
    assert.deepEqual(sent, []);
  });
});
