import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderKeySvg } from './key.ts';
import {
  TIMEOUT_RED,
  backKey,
  blankKey,
  connectionKey,
  connectionToggleKey,
  jammerKey,
  replaceChoiceKey,
  replaceConfirmKey,
  replaceInfoKey,
  undoKey
} from './designs.ts';
import { type TeamTheme } from './theme.ts';

const WHEELS: TeamTheme = { background: '#38205b', foreground: '#ffffff', glow: '#000000', name: 'Wheels' };

const words = (texts: readonly { text: string }[] | undefined): string[] => (texts ?? []).map((line) => line.text);

describe('undoKey', () => {
  it('reads HOLD at rest, with no dial', () => {
    assert.deepEqual(words(undoKey().texts), ['Undo', 'HOLD']);
    assert.doesNotMatch(renderKeySvg(undoKey()), /stroke-width="2"/);
  });

  it('shows the dial while held', () => {
    assert.match(renderKeySvg(undoKey(0.5)), /stroke-width="2"/);
  });

  it('fills its dial in the key’s own color, the whole way', () => {
    assert.match(renderKeySvg(undoKey(0.5)), /stroke="#fbbf24" stroke-width="2"/);
    assert.match(renderKeySvg(undoKey(0.8)), /stroke="#fbbf24" stroke-width="2"/);
  });

  it('draws its bar over the hazard striping, not under it', () => {
    const svg = renderKeySvg(undoKey(0, false));

    assert.ok(
      svg.indexOf('height="12"') > svg.lastIndexOf('rotate(30 50 50)'),
      'the bar should be drawn after the striping, so the stripes cannot show through'
    );
  });

  it('carries no bar without Replace on Undo, and the active bar while CRG waits', () => {
    assert.equal(undoKey().bar, undefined);
    assert.equal(undoKey(0, false).bar?.active, false);
    assert.equal(undoKey(0, true).bar?.active, true);
  });

  it('gives the hold to the bar once it has one, and drops the dial', () => {
    const held = renderKeySvg(undoKey(0.4, false));

    assert.doesNotMatch(held, /stroke-width="2"/);
    assert.match(held, /<rect width="40" height="12" fill="#22c55e"\/>/);
  });

  it('fills green from the left whether or not CRG is already waiting', () => {
    assert.match(renderKeySvg(undoKey(0.4, true)), /<rect width="40" height="12" fill="#22c55e"\/>/);
  });
});

describe('Undo page keys', () => {
  it('ask for a hold to confirm on every key but the informational one', () => {
    assert.deepEqual(words(replaceConfirmKey('No Action').texts), ['No Action', 'HOLD TO', 'CONFIRM']);
    assert.deepEqual(words(replaceChoiceKey('Stop Jam', 'stop').texts), ['Stop Jam', 'HOLD TO', 'CONFIRM']);
    assert.deepEqual(words(replaceInfoKey('Stop Jam').texts), ['REPLACE', 'Stop Jam', 'WITH']);
    assert.equal(replaceInfoKey('Stop Jam').informational, true);
  });

  it('draw No Action like the Undo key that opened the page', () => {
    const svg = renderKeySvg(replaceConfirmKey('No Action'));

    assert.match(svg, /fill="#1c1917"/);
    assert.match(svg, /rotate\(30 50 50\)/);
  });

  it('color each choice by what it does', () => {
    assert.equal(replaceChoiceKey('Start Jam', 'start').background, '#14532d');
    assert.equal(replaceChoiceKey('Stop Jam', 'stop').background, '#8c1d1d');
    assert.equal(replaceChoiceKey('Timeout', 'timeout').background, TIMEOUT_RED);
  });

  it('run a choice’s hold red across a gray bar, with no dial', () => {
    for (const kind of ['start', 'stop', 'timeout'] as const) {
      const spec = replaceChoiceKey('Choice', kind, 0.4);

      assert.deepEqual(spec.bar, { active: false, progress: 0.4, fill: 'danger' }, kind);
      assert.doesNotMatch(renderKeySvg(spec), /stroke-width="2"/, kind);
      assert.match(renderKeySvg(spec), /<rect width="40" height="12" fill="#ef4444"\/>/, kind);
    }
  });

  it('keep the dial on No Action', () => {
    assert.match(renderKeySvg(replaceConfirmKey('No Action', 0.5)), /stroke-width="2"/);
  });

  it('leave a choice CRG does not allow blank, like an empty key', () => {
    assert.deepEqual(blankKey(), { background: '#000000' });
  });
});

describe('connection page keys', () => {
  it('read like CRG Connection, then say what a hold does', () => {
    assert.deepEqual(words(connectionToggleKey('connected').texts), ['CRG', 'Connected', 'HOLD TO', 'DISCONNECT']);
    assert.deepEqual(words(connectionToggleKey('connecting').texts), ['CRG', 'Connecting', 'HOLD TO', 'DISCONNECT']);
    assert.deepEqual(words(connectionToggleKey('disconnected').texts), ['NO CRG', 'Offline', 'HOLD TO', 'DISCONNECT']);
    assert.deepEqual(words(connectionToggleKey('stopped').texts), ['CRG', 'Disconnected', 'HOLD TO', 'CONNECT']);
  });

  it('run a hold to disconnect red across a green bar, and a hold to connect green across a gray one', () => {
    for (const status of ['connected', 'connecting', 'disconnected', 'unauthorized'] as const) {
      assert.deepEqual(connectionToggleKey(status, 0.5).bar, { active: true, progress: 0.5, fill: 'danger' }, status);
    }

    assert.deepEqual(connectionToggleKey('stopped', 0.5).bar, { active: false, progress: 0.5, fill: 'next' });
    assert.match(renderKeySvg(connectionToggleKey('connected', 0.5)), /<rect width="50" height="12" fill="#ef4444"\/>/);
    assert.match(renderKeySvg(connectionToggleKey('stopped', 0.5)), /<rect width="50" height="12" fill="#22c55e"\/>/);
  });

  it('draw no dial, since the bar carries the hold', () => {
    assert.doesNotMatch(renderKeySvg(connectionToggleKey('connected', 0.5)), /stroke-width="2"/);
    assert.doesNotMatch(renderKeySvg(connectionToggleKey('stopped', 0.5)), /stroke-width="2"/);
  });

  it('draw every line in the key’s own text color', () => {
    for (const status of ['connected', 'connecting', 'disconnected', 'unauthorized', 'stopped'] as const) {
      assert.ok(
        connectionToggleKey(status).texts?.every((line) => line.color === undefined),
        status
      );
    }
  });

  it('share the CRG Connection key’s background for the same state', () => {
    for (const status of ['connected', 'connecting', 'disconnected', 'unauthorized', 'stopped'] as const) {
      assert.equal(connectionToggleKey(status).background, connectionKey(status).background, status);
    }
  });

  it('tell a deck disconnected on purpose from one that lost CRG', () => {
    assert.deepEqual(words(connectionKey('stopped').texts), ['CRG', 'Disconnected']);
    assert.deepEqual(words(connectionKey('disconnected').texts), ['NO CRG', 'Offline']);
  });

  it('draw Back as an arrow and a word', () => {
    assert.deepEqual(words(backKey().texts), ['Back']);
    assert.equal(backKey().shapes?.length, 1);
  });
});

describe('Star Pass while No Pivot is on', () => {
  it('is subdued, with the reason across its icon, and the bar kept', () => {
    const spec = jammerKey(WHEELS, 'starPass', false, 'NO PIVOT');

    assert.equal(spec.texts?.[1]?.opacity, 0.38);
    assert.equal(spec.texts?.[2]?.text, 'NO PIVOT');
    assert.deepEqual(spec.bar, { active: false });
    assert.doesNotMatch(renderKeySvg(spec), /stroke="#ffffff"/);
  });
});
