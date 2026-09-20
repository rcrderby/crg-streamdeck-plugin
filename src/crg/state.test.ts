import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { StateStore, toPattern } from './state.ts';

describe('toPattern', () => {
  it('keeps a pattern it has already built, since the same paths are matched on every message', () => {
    assert.equal(toPattern('ScoreBoard.CurrentGame.Team(*).Score'), toPattern('ScoreBoard.CurrentGame.Team(*).Score'));
  });

  it('matches a literal path', () => {
    assert.ok(toPattern('ScoreBoard.CurrentGame.InJam').test('ScoreBoard.CurrentGame.InJam'));
  });

  it('does not match a longer path', () => {
    assert.ok(!toPattern('ScoreBoard.CurrentGame.Team(1)').test('ScoreBoard.CurrentGame.Team(1).Score'));
  });

  it('reads a star as one argument', () => {
    const pattern = toPattern('ScoreBoard.CurrentGame.Team(*).Score');

    assert.ok(pattern.test('ScoreBoard.CurrentGame.Team(1).Score'));
    assert.ok(pattern.test('ScoreBoard.CurrentGame.Team(2).Score'));
    assert.ok(!pattern.test('ScoreBoard.CurrentGame.Team(1).JamScore'));
  });

  it('does not let a star cross a dot', () => {
    assert.ok(!toPattern('ScoreBoard.CurrentGame.*').test('ScoreBoard.CurrentGame.Team(1).Score'));
  });

  it('treats regular expression characters in a path as literals', () => {
    const pattern = toPattern('ScoreBoard.CurrentGame.Label(Start)');

    assert.ok(pattern.test('ScoreBoard.CurrentGame.Label(Start)'));
    assert.ok(!pattern.test('ScoreBoardXCurrentGame.Label(Start)'));
  });
});

describe('StateStore values', () => {
  it('reads text, numbers, and flags', () => {
    const store = new StateStore();

    store.apply({ 'a.Name': 'Rose City', 'a.Score': 42, 'a.Lead': true });

    assert.equal(store.getString('a.Name'), 'Rose City');
    assert.equal(store.getNumber('a.Score'), 42);
    assert.equal(store.getBoolean('a.Lead'), true);
  });

  it('falls back when a path is absent or empty', () => {
    const store = new StateStore();

    store.apply({ 'a.Name': '' });

    assert.equal(store.getString('a.Name', 'Team 1'), 'Team 1');
    assert.equal(store.getString('a.Missing', 'Team 2'), 'Team 2');
    assert.equal(store.getNumber('a.Missing', -1), -1);
    assert.equal(store.getBoolean('a.Missing', true), true);
  });

  it('reads a number sent as text', () => {
    const store = new StateStore();

    store.apply({ 'a.Score': '17' });

    assert.equal(store.getNumber('a.Score'), 17);
  });

  it('falls back for text that is not a number', () => {
    const store = new StateStore();

    store.apply({ 'a.Score': 'unknown' });

    assert.equal(store.getNumber('a.Score', 0), 0);
  });

  it('reads a flag sent as text', () => {
    const store = new StateStore();

    store.apply({ 'a.Lead': 'true', 'a.Lost': 'false' });

    assert.equal(store.getBoolean('a.Lead'), true);
    assert.equal(store.getBoolean('a.Lost'), false);
  });
});

describe('StateStore matching', () => {
  it('finds every held path a pattern names, with its value', () => {
    const store = new StateStore();

    store.apply({
      'g.Period(1).Timeout(a).Running': false,
      'g.Period(1).Timeout(b).Running': true,
      'g.Period(2).Timeout(c).Running': false,
      'g.Period(1).Timeout(b).Owner': 'O'
    });

    const found = store.matching('g.Period(*).Timeout(*).Running');

    assert.deepEqual(found.map(([path]) => path).sort(), [
      'g.Period(1).Timeout(a).Running',
      'g.Period(1).Timeout(b).Running',
      'g.Period(2).Timeout(c).Running'
    ]);
    assert.ok(found.some(([, value]) => value === true));
  });

  it('finds nothing when nothing matches', () => {
    assert.deepEqual(new StateStore().matching('g.Team(*).Score'), []);
  });
});

describe('StateStore deltas', () => {
  it('reports only the paths whose value changed', () => {
    const store = new StateStore();

    store.apply({ 'a.Score': 1, 'a.JamScore': 2 });

    const changed = store.apply({ 'a.Score': 1, 'a.JamScore': 3 });

    assert.deepEqual([...changed], ['a.JamScore']);
  });

  it('deletes a path sent as null', () => {
    const store = new StateStore();

    store.apply({ 'a.Score': 1 });

    const changed = store.apply({ 'a.Score': null });

    assert.deepEqual([...changed], ['a.Score']);
    assert.equal(store.get('a.Score'), undefined);
    assert.equal(store.size, 0);
  });

  it('does not report deleting a path it never held', () => {
    const store = new StateStore();

    assert.equal(store.apply({ 'a.Score': null }).size, 0);
  });
});

describe('StateStore subscriptions', () => {
  it('calls a listener once for a batch, with every changed path', () => {
    const store = new StateStore();
    const batches: string[][] = [];

    store.subscribe(['a.Score', 'a.JamScore'], (changed) => batches.push([...changed].sort()));

    store.apply({ 'a.Score': 1, 'a.JamScore': 2 });

    assert.deepEqual(batches, [['a.JamScore', 'a.Score']]);
  });

  it('does not call a listener for paths it did not name', () => {
    const store = new StateStore();
    let calls = 0;

    store.subscribe(['a.Score'], () => (calls += 1));

    store.apply({ 'a.JamScore': 2 });

    assert.equal(calls, 0);
  });

  it('matches a subscription that uses a star', () => {
    const store = new StateStore();
    let calls = 0;

    store.subscribe(['ScoreBoard.CurrentGame.Team(*).Score'], () => (calls += 1));

    store.apply({ 'ScoreBoard.CurrentGame.Team(2).Score': 5 });

    assert.equal(calls, 1);
  });

  it('stops calling a listener once it unsubscribes', () => {
    const store = new StateStore();
    let calls = 0;

    const unsubscribe = store.subscribe(['a.Score'], () => (calls += 1));

    store.apply({ 'a.Score': 1 });
    unsubscribe();
    store.apply({ 'a.Score': 2 });

    assert.equal(calls, 1);
  });
});

describe('StateStore.replace', () => {
  it('drops what the snapshot leaves out, keeps what it is told to, and reports both', () => {
    const store = new StateStore();
    const heard: string[][] = [];

    store.apply({ 'A.One': 1, 'A.Two': 2, 'WS.Device': 'deck' });
    store.subscribe(['A.*'], (changed) => heard.push([...changed].sort()));

    const changed = store.replace({ 'A.One': 1, 'A.Three': 3 }, (path) => path.startsWith('WS.'));

    assert.deepEqual([...changed].sort(), ['A.Three', 'A.Two']);
    assert.equal(store.get('A.Two'), undefined);
    assert.equal(store.get('A.Three'), 3);
    assert.equal(store.get('WS.Device'), 'deck');
    assert.deepEqual(heard, [['A.Three', 'A.Two']]);
  });

  it('reports nothing when the snapshot matches what is held', () => {
    const store = new StateStore();

    store.apply({ 'A.One': 1 });

    assert.equal(store.replace({ 'A.One': 1 }).size, 0);
  });
});

describe('clear', () => {
  it('tells the subscriptions what went, so no key draws the last scoreboard', () => {
    const store = new StateStore();
    const seen: string[][] = [];

    store.apply({ 'ScoreBoard.CurrentGame.Team(1).Score': 113 });
    store.subscribe(['ScoreBoard.CurrentGame.Team(*).Score'], (changed) => seen.push([...changed]));
    store.clear();

    assert.deepEqual(seen, [['ScoreBoard.CurrentGame.Team(1).Score']]);
    assert.equal(store.get('ScoreBoard.CurrentGame.Team(1).Score'), undefined);
  });

  it('tells them nothing when it held nothing', () => {
    const store = new StateStore();
    let told = 0;

    store.subscribe(['ScoreBoard.CurrentGame.Team(*).Score'], () => (told += 1));
    store.clear();

    assert.equal(told, 0);
  });
});
