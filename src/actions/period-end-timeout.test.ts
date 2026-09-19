import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import { SecondsAtTimeout, SecondsDown, SecondsUp, StartPeriodEndTimeout } from './period-end-timeout.ts';
import { Back } from './connection-page.ts';
import { clock, game } from '../crg/paths.ts';

/** The SVG a key was last drawn with, out of the data URI Stream Deck is sent. */
function drawn(key: FakeKey): string {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

describe('the Timeout Before Period End page', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('shows the seconds, and redraws as +1 and −1 change them', async () => {
    const shown = new SecondsAtTimeout(deck.context);
    const up = new SecondsUp(deck.context);
    const seconds = deck.place(shown);

    assert.match(drawn(seconds), />0:01</);

    const plus = deck.place(up);

    await deck.press(up, plus);
    await deck.press(up, plus);
    deck.draw();

    assert.match(drawn(seconds), />0:03</);
  });

  it('goes down to 0:00 and no further, darkening −1 there', async () => {
    const down = new SecondsDown(deck.context);
    const minus = deck.place(down);

    await deck.press(down, minus);
    await deck.press(down, minus);
    deck.draw();

    assert.equal(deck.periodEndSeconds.value, 0);
    assert.ok(drawn(minus).includes('opacity="0.62"'));
  });

  it('starts the timeout, then sets the period clock, then returns to the layout', async () => {
    const start = new StartPeriodEndTimeout(deck.context);
    const key = deck.place(start);

    deck.periodEndSeconds.step(4);
    await deck.holdDown(start, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [
      { key: game('Timeout'), value: true, flag: '' },
      { key: clock('Period', 'Time'), value: 5000, flag: '' }
    ]);
    assert.deepEqual(deck.switched, [{ deviceId: 'device-1', profile: undefined }]);
  });

  it('does nothing on a quick press of Start Timeout', async () => {
    const start = new StartPeriodEndTimeout(deck.context);

    await deck.press(start, deck.place(start));

    assert.deepEqual(deck.written, []);
    assert.deepEqual(deck.switched, []);
  });

  it('goes Back to the End of Period page by way of the layout', async () => {
    const back = new Back(deck.context);
    const settings = { page: 'end-of-period' };

    await deck.press(back, deck.place(back, settings), settings);

    assert.deepEqual(deck.switched, [
      { deviceId: 'device-1', profile: undefined },
      { deviceId: 'device-1', profile: 'profiles/end-of-period-xl' }
    ]);
  });
});
