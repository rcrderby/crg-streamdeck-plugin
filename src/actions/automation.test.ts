import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { AUTOMATION_SETTINGS } from '../crg/paths.ts';
import { AutoEndJams, AutoEndTeamTimeouts, Automation } from './automation.ts';
import { FakeDeck, PEDAL } from '../test-support/fake-deck.ts';

/** The SVG a key was last drawn with, out of the data URI Stream Deck is sent. */
function drawn(image: string | undefined): string {
  return Buffer.from((image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');
}

describe('the Automation key', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('opens the Automation page', async () => {
    const keyAction = new Automation(deck.context);

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.switched, [{ deviceId: 'device-1', profile: 'profiles/automation-xl' }]);
  });

  it('does nothing on a model with no page', async () => {
    const keyAction = new Automation(deck.context);

    await deck.press(keyAction, deck.place(keyAction, {}, PEDAL));

    assert.deepEqual(deck.switched, []);
  });

  it('stays unveiled while CRG is disconnected, since it shows nothing from CRG', () => {
    const keyAction = new Automation(deck.context);
    const key = deck.place(keyAction);

    deck.client.say('disconnected');
    deck.draw();

    assert.ok(!drawn(key.image).includes('opacity="0.62"'));
  });
});

describe('the automation toggles', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('turn a setting on when CRG holds it off, writing the text CRG keeps', async () => {
    const keyAction = new AutoEndJams(deck.context);

    deck.hold({ [AUTOMATION_SETTINGS.endJams]: 'false' });

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: AUTOMATION_SETTINGS.endJams, value: 'true', flag: '' }]);
  });

  it('turn a setting off when CRG holds it on', async () => {
    const keyAction = new AutoEndTeamTimeouts(deck.context);

    deck.hold({ [AUTOMATION_SETTINGS.endTeamTimeouts]: 'true' });

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: AUTOMATION_SETTINGS.endTeamTimeouts, value: 'false', flag: '' }]);
  });

  it('write the global setting, not an operator’s stored default', async () => {
    const keyAction = new AutoEndJams(deck.context);

    await deck.press(keyAction, deck.place(keyAction));

    assert.equal(deck.written[0]?.key, 'ScoreBoard.Settings.Setting(ScoreBoard.AutoEndJam)');
  });

  it('light the top bar while the setting is on, and redraw when CRG changes it', () => {
    const keyAction = new AutoEndTeamTimeouts(deck.context);
    const key = deck.place(keyAction);

    deck.hold({ [AUTOMATION_SETTINGS.endTeamTimeouts]: 'false' });
    deck.draw();
    assert.match(drawn(key.image), /#52525b/);

    deck.hold({ [AUTOMATION_SETTINGS.endTeamTimeouts]: 'true' });
    deck.draw();
    assert.match(drawn(key.image), /#22c55e/);
  });

  it('write nothing while CRG is disconnected, and show it by veiling the key', async () => {
    const keyAction = new AutoEndJams(deck.context);
    const key = deck.place(keyAction);

    deck.client.say('disconnected');
    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, []);
    assert.ok(drawn(key.image).includes('opacity="0.62"'));
  });
});
