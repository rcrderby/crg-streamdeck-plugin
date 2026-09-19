import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { setImmediate } from 'node:timers/promises';

import { FakeDeck, type FakeKey } from '../test-support/fake-deck.ts';
import { BAR_ACTIVE, BAR_INACTIVE } from '../render/key.ts';
import { HOLD_MS } from '../render/hold.ts';
import { Lead, LostLead, NoPivot, StarPass } from './team-flags.ts';
import { type TeamSettings } from './team-key-action.ts';
import { game, team } from '../crg/paths.ts';
import { type StateValue } from '../crg/state.ts';

/** The color a key's top bar was last drawn in, before any hold fill over it. */
function barColor(key: FakeKey<TeamSettings>): string | undefined {
  const svg = Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64').toString('utf8');

  return /<rect width="100" height="12" fill="(#[0-9a-f]{6})"\/>/.exec(svg)?.[1];
}

describe('the jam flag keys', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    deck = new FakeDeck();
  });

  afterEach(() => deck.stop());

  it('set the flag when it is off', async () => {
    const keyAction = new Lead(deck.context);

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: team(1, 'Lead'), value: true, flag: '' }]);
  });

  it('clear the flag when CRG holds it on', async () => {
    const keyAction = new Lead(deck.context);

    deck.hold({ [team(1, 'Lead')]: true });

    await deck.press(keyAction, deck.place(keyAction));

    assert.deepEqual(deck.written, [{ key: team(1, 'Lead'), value: false, flag: '' }]);
  });

  it('write to the team the key is set to', async () => {
    const keyAction = new NoPivot(deck.context);
    const settings: TeamSettings = { team: 2 };

    await deck.press(keyAction, deck.place(keyAction, settings), settings);

    assert.deepEqual(deck.written, [{ key: team(2, 'NoPivot'), value: true, flag: '' }]);
  });

  it('leave Star Pass alone while the team skates without a pivot, which CRG ignores', async () => {
    const keyAction = new StarPass(deck.context);

    deck.hold({ [team(1, 'NoPivot')]: true });

    const key = deck.place(keyAction);

    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, []);
    assert.equal(key.alerts, 0);
  });
});

describe('the Lost Lead key', () => {
  let deck: FakeDeck;
  let keyAction: LostLead;
  let key: FakeKey<TeamSettings>;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
    keyAction = new LostLead(deck.context);
    key = deck.place(keyAction);
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('does nothing on a press, since it sits beside Lead and undoes it', async () => {
    await deck.press(keyAction, key);

    assert.deepEqual(deck.written, []);
  });

  it('marks the lead lost once held for the full second', async () => {
    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [{ key: team(1, 'Lost'), value: true, flag: '' }]);
  });

  it('gives the lead back when CRG already holds it lost', async () => {
    deck.hold({ [team(1, 'Lost')]: true });

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();

    assert.deepEqual(deck.written, [{ key: team(1, 'Lost'), value: false, flag: '' }]);
  });

  it('fills its top bar as the hold runs, and drops the fill the moment the hold acts', async () => {
    const atRest = key.image;

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS / 2);
    deck.draw();

    assert.notEqual(key.image, atRest, 'a hold in progress should show');

    mock.timers.tick(HOLD_MS / 2);
    await setImmediate();
    deck.draw();

    assert.equal(barColor(key), BAR_ACTIVE, 'a hold that has acted should show the state it set, filled');
  });

  it('shows the state it set while CRG answers, rather than flashing the one it left', async () => {
    deck.hold({ [team(1, 'Lost')]: true });
    deck.draw();

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
    deck.draw();

    assert.equal(barColor(key), BAR_INACTIVE, 'before CRG answers');

    await deck.letGo(keyAction, key);
    assert.equal(barColor(key), BAR_INACTIVE, 'after letting go, before CRG answers');

    deck.hold({ [team(1, 'Lost')]: false });
    deck.draw();
    assert.equal(barColor(key), BAR_INACTIVE, 'once CRG answers');
  });

  it('goes back to what CRG holds if CRG never takes the change', async () => {
    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
    await deck.letGo(keyAction, key);

    assert.equal(barColor(key), BAR_ACTIVE, 'while it waits');

    mock.timers.tick(2000);
    deck.draw();

    assert.equal(barColor(key), BAR_INACTIVE, 'after waiting');
  });
});

/** Team 1's flags on jam 3 of period 2, the jam running or the last one between jams. */
function onJam(fields: { overtime?: boolean; suddenScoring?: boolean } = {}): Record<string, StateValue> {
  const period = 'ScoreBoard.CurrentGame.Period(2)';

  return {
    [team(1, 'RunningOrEndedTeamJam')]: 'jam-3_1',
    [`${period}.SuddenScoring`]: fields.suddenScoring ?? false,
    [`${period}.Jam(2).Id`]: 'jam-2',
    [`${period}.Jam(2).Overtime`]: false,
    [`${period}.Jam(3).Id`]: 'jam-3',
    [`${period}.Jam(3).Overtime`]: fields.overtime ?? false
  };
}

/** Whether a key was last drawn darkened. */
function darkened(key: FakeKey<TeamSettings>): boolean {
  return Buffer.from((key.image ?? '').split(',')[1] ?? '', 'base64')
    .toString('utf8')
    .includes('opacity="0.62"');
}

describe('Lead and Lost Lead, where CRG keeps no lead', () => {
  let deck: FakeDeck;

  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    deck = new FakeDeck();
  });

  afterEach(() => {
    deck.stop();
    mock.timers.reset();
  });

  it('darken Lead, and leave it alone, in an overtime jam', async () => {
    const keyAction = new Lead(deck.context);

    deck.hold(onJam({ overtime: true }));

    const key = deck.place(keyAction);

    await deck.press(keyAction, key);
    deck.draw();

    assert.deepEqual(deck.written, []);
    assert.ok(darkened(key));
  });

  it('darken Lead in a period of sudden scoring', () => {
    const keyAction = new Lead(deck.context);

    deck.hold(onJam({ suddenScoring: true }));

    const key = deck.place(keyAction);

    deck.draw();

    assert.ok(darkened(key));
  });

  it('keep Lead working on a regular jam, as in the lineup before overtime', async () => {
    const keyAction = new Lead(deck.context);

    deck.hold({ ...onJam(), [game('InOvertime')]: true });

    const key = deck.place(keyAction);

    await deck.press(keyAction, key);
    deck.draw();

    assert.deepEqual(deck.written, [{ key: team(1, 'Lead'), value: true, flag: '' }]);
    assert.ok(!darkened(key));
  });

  it('darken Lost Lead, and ignore a full hold, in an overtime jam', async () => {
    const keyAction = new LostLead(deck.context);

    deck.hold(onJam({ overtime: true }));

    const key = deck.place(keyAction);

    await deck.holdDown(keyAction, key);
    mock.timers.tick(HOLD_MS);
    await setImmediate();
    deck.draw();

    assert.deepEqual(deck.written, []);
    assert.ok(darkened(key));
  });
});
