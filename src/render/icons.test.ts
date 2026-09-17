import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  hazardStripes,
  leadIcon,
  lostLeadIcon,
  medicalCross,
  noPivotIcon,
  pivotIcon,
  resourceDots,
  starPassIcon,
  stripe,
  triangle,
  tripSign,
  undoArrow
} from './icons.ts';

const ALL = [
  leadIcon('#ffffff'),
  lostLeadIcon('#ffffff', '#38205b'),
  pivotIcon('#ffffff'),
  noPivotIcon('#ffffff', '#38205b'),
  starPassIcon('#ffffff'),
  medicalCross(50, 40, 30, '#fed7aa'),
  undoArrow(50, 42, 17, '#fbbf24'),
  hazardStripes('#fbbf24'),
  triangle(true, 37, 60, 22, '#ffffff'),
  tripSign(true, '#ffffff', '#38205b'),
  resourceDots(3, 2, '#ffffff')
];

/** Every number in a drawing's attributes, so a test can check none are broken. */
function numbers(markup: string): number[] {
  return [...markup.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

describe('icons', () => {
  it('use nothing Stream Deck’s renderer ignores', () => {
    for (const markup of ALL) {
      assert.ok(!/<filter|clipPath|clip-path|<mask|mask=/.test(markup), markup.slice(0, 80));
    }
  });

  it('produce only finite numbers', () => {
    for (const markup of ALL) {
      assert.ok(numbers(markup).every(Number.isFinite), markup.slice(0, 80));
      assert.ok(!markup.includes('NaN'), markup.slice(0, 80));
    }
  });

  it('never write a color that is not a hex color', () => {
    const markup = leadIcon('red"/><script>alert(1)</script>');

    assert.ok(!markup.includes('<script>'));
    assert.match(markup, /stroke="#ffffff"/);
  });
});

describe('struck icons', () => {
  it('draw their bar in the key background, then in the icon color', () => {
    const markup = lostLeadIcon('#ffffff', '#38205b');
    const lines = [...markup.matchAll(/<line [^>]*stroke="(#[0-9a-f]+)"/g)].map((match) => match[1]);

    assert.deepEqual(lines, ['#38205b', '#ffffff']);
  });

  it('draw the ring last, so the bar never cuts it', () => {
    assert.ok(noPivotIcon('#ffffff', '#38205b').endsWith('stroke-width="3"/>'));
    assert.match(noPivotIcon('#ffffff', '#38205b'), /<circle[^>]*\/>$/);
  });

  it('end the bar inside the ring', () => {
    const markup = lostLeadIcon('#ffffff', '#000000');
    const ends = /x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/.exec(markup);
    const [x1, y1, x2, y2] = (ends ?? []).slice(1).map(Number);

    assert.ok(Math.hypot((x1 ?? 0) - 50, (y1 ?? 0) - 38) < 21);
    assert.ok(Math.hypot((x2 ?? 0) - 50, (y2 ?? 0) - 38) < 21);
  });
});

describe('stripe', () => {
  it('stays inside its circle', () => {
    const path = /d="([^"]+)"/.exec(stripe(50, 38, 21, '#ffffff'))?.[1] ?? '';
    const points = [...path.matchAll(/(?:M|L|0 1) ([\d.]+) ([\d.]+)/g)].map((match) => [
      Number(match[1]),
      Number(match[2])
    ]);

    assert.equal(points.length, 4);
    assert.ok(points.every(([x = 0, y = 0]) => Math.hypot(x - 50, y - 38) <= 21));
  });
});

describe('tripSign', () => {
  it('cuts a plus for Add Trip and a minus for Remove Trip', () => {
    assert.equal((tripSign(true, '#ffffff', '#000000').match(/<line/g) ?? []).length, 2);
    assert.equal((tripSign(false, '#ffffff', '#000000').match(/<line/g) ?? []).length, 1);
  });

  it('cuts the sign in the key background', () => {
    assert.match(tripSign(true, '#ffffff', '#38205b'), /<line [^>]*stroke="#38205b"/);
  });
});

describe('the Star Pass arrow', () => {
  /** Reads the arc and the arrowhead back out of the drawing. */
  function parts(): { center: [number, number]; radius: number; arms: [number, number][] } {
    const markup = starPassIcon('#ffffff');
    const arc = /M ([\d.]+) ([\d.]+) A ([\d.]+) [\d.]+ 0 0 1 ([\d.]+) ([\d.]+)/.exec(markup);
    const head = /M ([\d.]+),([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+),([\d.]+)/.exec(markup);

    assert.ok(arc !== null, 'the arrow should draw an arc');
    assert.ok(head !== null, 'the arrow should draw a head');

    const [, sx, sy, r, ex] = (arc as RegExpExecArray).map(Number);
    const half = ((ex as number) - (sx as number)) / 2;
    const drop = Math.sqrt((r as number) ** 2 - half ** 2);

    const [, x1, y1, , , x3, y3] = (head as RegExpExecArray).map(Number);

    return {
      center: [(sx as number) + half, (sy as number) + drop],
      radius: r as number,
      arms: [
        [x1 as number, y1 as number],
        [x3 as number, y3 as number]
      ]
    };
  }

  it('leaves the same gap between the arc and each arm of its head', () => {
    const { center, radius, arms } = parts();

    const [first, second] = arms.map(([x, y]) => Math.abs(Math.hypot(x - center[0], y - center[1]) - radius));

    assert.ok(
      Math.abs((first as number) - (second as number)) < 0.01,
      `the arms sit ${first} and ${second} from the arc, which should match`
    );
  });

  it('puts one arm inside the arc and the other outside it', () => {
    const { center, radius, arms } = parts();

    const [first, second] = arms.map(([x, y]) => Math.hypot(x - center[0], y - center[1]) - radius);

    assert.ok(
      (first as number) * (second as number) < 0,
      'the head should straddle the arc rather than sit to one side'
    );
  });
});

describe('resourceDots', () => {
  it('holds the count inside what a key has room for, since it comes from a rule an operator types', () => {
    const dots = (markup: string): number => [...markup.matchAll(/<circle/g)].length;

    assert.equal(dots(resourceDots(10_000, 3, '#ffffff')), 12);
    assert.equal(dots(resourceDots(-4, 0, '#ffffff')), 0);
    assert.equal(dots(resourceDots(2.7, 1, '#ffffff')), 2);
    assert.equal(dots(resourceDots(Number.NaN, 0, '#ffffff')), 0);
  });

  it('fills a dot for each one left and outlines the rest', () => {
    const markup = resourceDots(3, 1, '#ffffff');

    assert.equal((markup.match(/fill="#ffffff"/g) ?? []).length, 1);
    assert.equal((markup.match(/fill="none"/g) ?? []).length, 2);
  });

  it('draws a plus in place of the dot for a review won once', () => {
    const markup = resourceDots(1, 1, '#ffffff', 80, 'retained');

    assert.equal((markup.match(/<line/g) ?? []).length, 2);
    assert.ok(!markup.includes('<circle'));
    assert.ok(!markup.includes('opacity'));
  });

  it('draws a subdued line for a review won twice', () => {
    const markup = resourceDots(1, 0, '#ffffff', 80, 'twice');

    assert.equal((markup.match(/<line/g) ?? []).length, 1);
    assert.match(markup, /opacity="0.38"/);
  });

  it('centers its dots on the key', () => {
    const centers = [...resourceDots(3, 3, '#ffffff').matchAll(/cx="([\d.]+)"/g)].map((match) => Number(match[1]));

    assert.ok(Math.abs((centers[0] ?? 0) + (centers[2] ?? 0) - 100) < 0.05);
  });
});
