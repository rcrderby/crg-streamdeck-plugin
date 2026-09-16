import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { HOLD_MS } from '../render/hold.ts';
import { HoldKeyAction } from './hold-key-action.ts';
import { type KeySpec } from '../render/key.ts';

type Settings = { allowed?: boolean };

/** A key that counts its completed holds and draws how far along one is. */
class CountingHold extends HoldKeyAction<Settings> {
  readonly completed: string[] = [];

  level = 0;

  protected override watchedPaths(): readonly string[] {
    return ['Test.Word'];
  }

  protected override canHold(settings: Settings): boolean {
    return settings.allowed !== false;
  }

  protected override describe(_settings: Settings, actionId: string): KeySpec {
    this.level = this.holdLevel(actionId);

    return { background: '#000000', texts: [{ text: `${Math.round(this.level * 100)}`, y: 50, size: 20 }] };
  }

  protected override completeHold(action: { id: string }): void {
    this.completed.push(action.id);
  }
}

describe('a key that acts on a hold', () => {
  let deck: FakeDeck;
  let keyAction: CountingHold;
  let key: FakeKey<Settings>;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new CountingHold(deck.context);
    key = deck.place(keyAction);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('acts once the full second is held, while the key is still down', async () => {
    await deck.holdDown(keyAction, key);

    assert.deepEqual(keyAction.completed, []);

    mock.timers.tick(HOLD_MS);

    assert.deepEqual(keyAction.completed, [key.id]);
  });

  it('does nothing when the key is let go early', async () => {
    await deck.holdDown(keyAction, key);

    mock.timers.tick(HOLD_MS - 1);
    await deck.letGo(keyAction, key);
    mock.timers.tick(HOLD_MS);

    assert.deepEqual(keyAction.completed, []);
  });

  it('draws the hold filling as it runs, and empty once let go', async () => {
    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS / 2);
    deck.draw();

    assert.equal(keyAction.level, 0.5);

    await deck.letGo(keyAction, key);

    assert.equal(keyAction.level, 0);
  });

  it('reports a hold that has already acted as complete, until the key is let go', async () => {
    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    deck.draw();

    assert.equal(keyAction.level, 1);

    await deck.letGo(keyAction, key);

    assert.equal(keyAction.level, 0);
  });

  it('does nothing at all on a key CRG will not act on, not even an alert', async () => {
    const barred = deck.place(keyAction, { allowed: false });

    await deck.holdDown(keyAction, barred, { allowed: false });
    mock.timers.tick(HOLD_MS);

    assert.deepEqual(keyAction.completed, []);
    assert.equal(barred.alerts, 0);
  });

  it('drops a hold when the key leaves the deck mid-press', async () => {
    await deck.holdDown(keyAction, key);

    deck.remove(keyAction, key);
    mock.timers.tick(HOLD_MS);

    assert.deepEqual(keyAction.completed, []);
  });

  it('holds each key of its own accord', async () => {
    const second = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS / 2);
    await deck.holdDown(keyAction, second);
    mock.timers.tick(HOLD_MS / 2);

    assert.deepEqual(keyAction.completed, [key.id]);

    mock.timers.tick(HOLD_MS / 2);

    assert.deepEqual(keyAction.completed, [key.id, second.id]);
  });
});
