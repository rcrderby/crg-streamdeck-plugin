import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { FakeDeck } from '../test-support/fake-deck.ts';
import { CrgKeyAction, isOnline, named } from './key-action.ts';
import { type KeySpec } from '../render/key.ts';

type Settings = { word?: string };

type NarrowSettings = { watch?: string };

/** A key of the simplest kind: one watched path, one line of text. */
class WordKey extends CrgKeyAction<Settings> {
  drawn = 0;

  protected override watchedPaths(): readonly string[] {
    return ['Test.Word', 'Test.Other'];
  }

  protected override describe(settings: Settings): KeySpec {
    this.drawn += 1;

    return {
      background: '#000000',
      texts: [{ text: settings.word ?? this.context.client.state.getString('Test.Word', '-'), y: 50, size: 20 }]
    };
  }
}

/** A key that shows, and cares about, only the path its settings name. */
class NarrowKey extends CrgKeyAction<NarrowSettings> {
  protected override watchedPaths(): readonly string[] {
    return ['Test.Word', 'Test.Other'];
  }

  protected override concerns(settings: NarrowSettings, changed: ReadonlySet<string>): boolean {
    return changed.has(settings.watch ?? 'Test.Word');
  }

  protected override describe(settings: NarrowSettings): KeySpec {
    return {
      background: '#000000',
      texts: [{ text: this.context.client.state.getString(settings.watch ?? 'Test.Word', '-'), y: 50, size: 20 }]
    };
  }
}

describe('isOnline', () => {
  it('counts a refused write as online, because the game can still be read', () => {
    assert.equal(isOnline('connected'), true);
    assert.equal(isOnline('unauthorized'), true);
    assert.equal(isOnline('connecting'), false);
    assert.equal(isOnline('disconnected'), false);
    assert.equal(isOnline('stopped'), false);
  });
});

describe('named', () => {
  it('gives an action the identifier its manifest entry carries', () => {
    const deck = new FakeDeck();
    const keyAction = named('com.rcrderby.crg-streamdeck.test', new WordKey(deck.context));

    deck.stop();

    assert.equal(keyAction.manifestId, 'com.rcrderby.crg-streamdeck.test');
  });
});

describe('a CRG key', () => {
  let deck: FakeDeck;
  let keyAction: WordKey;

  beforeEach(() => {
    deck = new FakeDeck();
    keyAction = new WordKey(deck.context);
  });

  afterEach(() => deck.stop());

  it('draws itself as soon as it appears', () => {
    deck.hold({ 'Test.Word': 'Jam' });

    const key = deck.place(keyAction);

    assert.equal(key.images.length, 1);
    assert.match(key.image ?? '', /^data:image\/svg\+xml;base64,/);
  });

  it('redraws when a path it watches changes', () => {
    const key = deck.place(keyAction);

    deck.hold({ 'Test.Word': 'Lineup' });
    deck.draw();

    assert.equal(key.images.length, 2);
    assert.notEqual(key.images[0], key.images[1]);
  });

  it('stays still when a change would draw the same picture', () => {
    const key = deck.place(keyAction);

    deck.hold({ 'Test.Other': 'something else' });
    deck.draw();

    assert.equal(key.images.length, 1);
  });

  it('draws once for a burst of changes, rather than once per message', () => {
    const key = deck.place(keyAction);

    deck.hold({ 'Test.Word': 'one' });
    deck.hold({ 'Test.Word': 'two' });
    deck.hold({ 'Test.Word': 'three' });
    deck.draw();

    assert.equal(key.images.length, 2);
    assert.equal(keyAction.drawn, 2);
  });

  it('draws nothing on a key that has gone', () => {
    const key = deck.place(keyAction);

    deck.remove(keyAction, key);
    deck.hold({ 'Test.Word': 'Lineup' });
    deck.draw();

    assert.equal(key.images.length, 1);
  });

  it('redraws when the property inspector changes a key’s settings', () => {
    const key = deck.place(keyAction, { word: 'first' });

    deck.resettle(keyAction, key, { word: 'second' });

    assert.equal(key.images.length, 2);
  });

  it('subdues every key while CRG is away, and lifts them when it returns', () => {
    const key = deck.place(keyAction);

    deck.client.say('disconnected');
    deck.draw();

    const offline = key.image;

    deck.client.say('connected');
    deck.draw();

    assert.notEqual(offline, key.images[0]);
    assert.equal(key.image, key.images[0]);
  });

  it('leaves a key alone when the change is not one it shows', () => {
    const narrow = new NarrowKey(deck.context);
    const jam = deck.place(narrow, { watch: 'Test.Word' });
    const other = deck.place(narrow, { watch: 'Test.Other' });

    deck.hold({ 'Test.Word': 'Lineup' });
    deck.draw();

    assert.equal(jam.images.length, 2);
    assert.equal(other.images.length, 1);
  });
});
