import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderKeySvg } from './key.ts';
import {
  TIMEOUT_RED,
  clockKey,
  injuryKey,
  jamControlKey,
  jammerKey,
  lineupBackground,
  lostLeadKey,
  noInitialKey,
  officialReviewKey,
  scoreKey,
  teamTimeoutKey,
  timeoutKey,
  tripAdjustKey,
  tripChangeKey,
  tripPointsKey,
  undoKey
} from './designs.ts';
import { type TeamTheme, panelColor } from './theme.ts';

const WHEELS: TeamTheme = { background: '#38205b', foreground: '#ffffff', glow: '#000000', name: 'Wheels' };

describe('jammer status keys', () => {
  it('put every caption on one line at one size', () => {
    for (const kind of ['lead', 'starPass', 'noPivot'] as const) {
      const texts = jammerKey(WHEELS, kind, false).texts ?? [];

      assert.equal(texts.length, 1, kind);
      assert.equal(texts[0]?.size, 17, kind);
    }
  });

  it('carry the top bar, active or not', () => {
    assert.deepEqual(jammerKey(WHEELS, 'lead', true).bar, { active: true });
    assert.deepEqual(jammerKey(WHEELS, 'starPass', false).bar, { active: false });
    assert.deepEqual(noInitialKey(WHEELS, true).bar, { active: true });
  });

  it('shadow their text in the team’s glow color', () => {
    assert.equal(jammerKey(WHEELS, 'noPivot', false).texts?.[0]?.shadow, '#000000');
  });

  it('draw in the team’s colors', () => {
    const spec = jammerKey(WHEELS, 'lead', false);

    assert.equal(spec.background, '#38205b');
    assert.equal(spec.foreground, '#ffffff');
  });
});

describe('the Lost Lead key', () => {
  it('asks for a hold, under a caption of its own', () => {
    assert.deepEqual(
      (lostLeadKey(WHEELS, false).texts ?? []).map((line) => line.text),
      ['Lost Lead', 'HOLD']
    );
  });

  it('carries the hold along its top bar rather than a dial', () => {
    assert.deepEqual(lostLeadKey(WHEELS, false, 0.4).bar, { active: false, progress: 0.4 });
    assert.doesNotMatch(renderKeySvg(lostLeadKey(WHEELS, false, 0.4)), /stroke-width="2"/);
  });

  it('fills toward the state the hold will leave it in', () => {
    assert.match(renderKeySvg(lostLeadKey(WHEELS, false, 0.5)), /width="50" height="10" fill="#22c55e"/);
    assert.match(renderKeySvg(lostLeadKey(WHEELS, true, 0.5)), /width="50" height="10" fill="#52525b"/);
  });

  it('fills from the left turning on, and empties from the right turning off', () => {
    assert.match(renderKeySvg(lostLeadKey(WHEELS, false, 0.25)), /<rect width="25" height="10" fill="#22c55e"\/>/);
    assert.match(
      renderKeySvg(lostLeadKey(WHEELS, true, 0.25)),
      /<rect x="75" width="25" height="10" fill="#52525b"\/>/
    );
  });

  it('draws nothing along the bar before the key is held', () => {
    assert.equal((renderKeySvg(lostLeadKey(WHEELS, false)).match(/height="10"/g) ?? []).length, 1);
  });
});

describe('team resource keys', () => {
  it('subdue the title once a team has none left', () => {
    assert.equal(teamTimeoutKey(WHEELS, 3, 0, false).texts?.[0]?.opacity, 0.38);
    assert.equal(teamTimeoutKey(WHEELS, 3, 1, false).texts?.[0]?.opacity, undefined);
  });

  it('show the top bar while their timeout or review runs', () => {
    assert.equal(teamTimeoutKey(WHEELS, 3, 2, true).bar?.active, true);
    assert.equal(officialReviewKey(WHEELS, 1, 0, undefined, true).bar?.active, true);
  });

  it('mark a review won', () => {
    const svg = renderKeySvg(officialReviewKey(WHEELS, 1, 1, 'retained', false));

    assert.equal((svg.match(/<line/g) ?? []).length, 2);
  });
});

describe('injuryKey', () => {
  it('carries the same top bar as every other key, in its own colors', () => {
    const spec = injuryKey(true);

    assert.deepEqual(spec.bar, { active: true });
    assert.equal(spec.background, '#7c2d12');
  });
});

describe('scoring keys', () => {
  it('draw Trip Points with no border, no dimming, and no accent', () => {
    const spec = tripPointsKey(WHEELS, 4);

    assert.equal(spec.accent, undefined);
    assert.equal(spec.bar, undefined);
    assert.equal(spec.texts?.[1]?.text, '+4');
    assert.equal(spec.texts?.[1]?.opacity, undefined);
  });

  it('carry the team name at the top', () => {
    for (const spec of [tripPointsKey(WHEELS, 2), tripAdjustKey(WHEELS, true), tripChangeKey(WHEELS, false)]) {
      assert.equal(spec.texts?.[0]?.text, 'Wheels');
    }
  });

  it('put the arrow left of the 1', () => {
    assert.equal(tripAdjustKey(WHEELS, false).texts?.[1]?.x, 66);
  });

  it('label the trip keys', () => {
    assert.equal(tripChangeKey(WHEELS, true).texts?.[1]?.text, 'Add Trip');
    assert.equal(tripChangeKey(WHEELS, false).texts?.[1]?.text, 'Remove Trip');
  });
});

describe('scoreKey', () => {
  /** The y, height and x of each panel, read back out of the drawing. */
  function panels(total: number, jam: number): { x: number; y: number; width: number; height: number }[] {
    const svg = renderKeySvg(scoreKey(WHEELS, total, jam, 2));

    return [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" rx=/g)].map(
      (found) => ({
        x: Number(found[1]),
        y: Number(found[2]),
        width: Number(found[3]),
        height: Number(found[4])
      })
    );
  }

  it('stands both panels on one line, the jam points to the right', () => {
    const [totalPanel, jamPanel] = panels(11, 7);

    assert.ok(totalPanel !== undefined && jamPanel !== undefined, 'both numbers should sit on a panel');
    assert.equal(
      (totalPanel as { y: number; height: number }).y + (totalPanel as { height: number }).height,
      (jamPanel as { y: number; height: number }).y + (jamPanel as { height: number }).height
    );
    assert.ok((jamPanel as { x: number }).x > (totalPanel as { x: number }).x);
    assert.ok((totalPanel as { height: number }).height > (jamPanel as { height: number }).height);
  });

  it('holds both panels still as the score climbs', () => {
    assert.deepEqual(panels(4, 7), panels(188, 12));
  });

  it('shrinks a long number into its panel rather than widening it', () => {
    const sizeOf = (svg: string, text: string): number =>
      Number(new RegExp(`font-size="([\\d.]+)"[^>]*>${text}<`).exec(svg)?.[1] ?? 0);

    const short = renderKeySvg(scoreKey(WHEELS, 11, 7, 2));
    const long = renderKeySvg(scoreKey(WHEELS, 11, 188, 2));

    assert.ok(sizeOf(long, '188') < sizeOf(short, '7'), 'a three digit jam total should be set smaller');
  });

  it('lifts the panels from the key rather than outlining them', () => {
    const svg = renderKeySvg(scoreKey(WHEELS, 11, 7, 2));

    assert.doesNotMatch(svg, /stroke=/, 'the panels should carry no border');
    assert.ok(svg.includes(panelColor(WHEELS.background, WHEELS.foreground)), 'the panels should be lifted');
  });

  it('shows the total, jam points, and trip, marked as doing nothing when pressed', () => {
    const spec = scoreKey(WHEELS, 74, 4, 3);

    assert.deepEqual(
      spec.texts?.map((line) => line.text),
      ['Wheels', '74', '4', 'TRIP 3']
    );
    assert.equal(spec.informational, true);
  });
});

describe('timeoutKey', () => {
  it('stays red whether or not its timeout is running', () => {
    assert.equal(timeoutKey(['Timeout'], false).background, TIMEOUT_RED);
    assert.equal(timeoutKey(['Timeout'], true).background, TIMEOUT_RED);
  });

  it('shows the top bar active while its timeout is running', () => {
    assert.deepEqual(timeoutKey(['Official', 'Timeout'], true).bar, { active: true });
    assert.deepEqual(timeoutKey(['Official', 'Timeout'], false).bar, { active: false });
  });

  it('stacks two lines around the middle', () => {
    assert.deepEqual(
      timeoutKey(['Official', 'Timeout'], false).texts?.map((line) => line.y),
      [46, 66]
    );
  });
});

describe('undoKey', () => {
  it('stands apart in amber on hazard striping', () => {
    const svg = renderKeySvg(undoKey());

    assert.match(svg, /fill="#1c1917"/);
    assert.match(svg, /rotate\(30 50 50\)/);
    assert.match(svg, />Undo</);
  });
});

describe('clockKey', () => {
  it('shows its title over its time, with a green accent while running, marked as doing nothing', () => {
    const spec = clockKey('POST TIMEOUT', '0:05', true);

    assert.deepEqual(
      spec.texts?.map((line) => line.text),
      ['POST TIMEOUT', '0:05']
    );
    assert.equal(spec.accent, '#22c55e');
    assert.equal(spec.informational, true);
    assert.equal(clockKey('LINEUP', '0:30', false).accent, '#3f3f46');
  });

  it('shows the title alone, on two lines when it is too wide, when the clock is hidden', () => {
    assert.deepEqual(
      clockKey('UNOFFICIAL SCORE', undefined, false).texts?.map((line) => line.text),
      ['UNOFFICIAL', 'SCORE']
    );
    assert.deepEqual(
      clockKey('HALFTIME', undefined, false).texts?.map((line) => line.text),
      ['HALFTIME']
    );
    assert.equal(clockKey('COMING UP', undefined, false).informational, true);
  });
});

describe('the Jam Control key', () => {
  it('leads with what a press does, and closes with the clock it shows', () => {
    const texts = jamControlKey('Start Jam', '0:12', ['LINEUP'], '#14532d', false).texts ?? [];

    assert.deepEqual(
      texts.map((line) => line.text),
      ['START JAM', '0:12', 'LINEUP']
    );
  });

  it('fills the key with the wording alone when no clock is running', () => {
    const texts = jamControlKey('Start Jam', undefined, [], '#14532d', false).texts ?? [];

    assert.deepEqual(
      texts.map((line) => line.text),
      ['START', 'JAM']
    );
  });

  it('stacks a two line foot, and gives the clock less room so both read at one size', () => {
    const one = jamControlKey('Start Jam', '0:21', ['LINEUP'], '#14532d', false).texts ?? [];
    const two = jamControlKey('Start Jam', '0:21', ['POST TIMEOUT', 'JAM 13'], '#14532d', false).texts ?? [];

    assert.deepEqual(
      two.map((line) => line.text),
      ['START JAM', '0:21', 'POST TIMEOUT', 'JAM 13']
    );

    for (const line of two.slice(2)) {
      assert.equal(line.size, 10, 'a stacked foot line keeps the size one line has');
    }

    assert.ok((two[1]?.y ?? 0) < (one[1]?.y ?? 0), 'the clock moves up to make room');
    assert.ok((two[2]?.y ?? 0) < (two[3]?.y ?? 0), 'the clock name sits above the jam number');
  });

  it('turns orange as the lineup falls due, and moves between the two once it is over', () => {
    assert.equal(lineupBackground('none'), '#14532d');
    assert.equal(lineupBackground('due'), '#9a3412');
    assert.equal(lineupBackground('over', 0), '#14532d');
    assert.equal(lineupBackground('over', 1), '#9a3412');
    assert.notEqual(lineupBackground('over', 0.5), lineupBackground('over', 0));
  });
});
