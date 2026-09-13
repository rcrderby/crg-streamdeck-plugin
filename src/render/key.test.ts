import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VIEWBOX, estimateTextWidth, fittedSize, renderKey, renderKeySvg } from './key.ts';

describe('renderKeySvg', () => {
  it('draws in a square viewBox so any model can scale it', () => {
    const svg = renderKeySvg({});

    assert.match(svg, new RegExp(`viewBox="0 0 ${VIEWBOX} ${VIEWBOX}"`));
  });

  it('uses the colors it is given', () => {
    const svg = renderKeySvg({ background: '#b3122e', foreground: '#ffffff', texts: [{ text: '5', y: 60, size: 40 }] });

    assert.match(svg, /fill="#b3122e"/);
    assert.match(svg, /fill="#ffffff"/);
  });

  it('falls back when a color is not a hex color', () => {
    const svg = renderKeySvg({ background: 'red" onload="alert(1)' });

    assert.ok(!svg.includes('onload'));
    assert.match(svg, /fill="#000000"/);
  });

  it('escapes text that arrives from CRG', () => {
    const svg = renderKeySvg({ texts: [{ text: '</text><script>x</script>', y: 50, size: 10 }] });

    assert.ok(!svg.includes('<script>'));
    assert.match(svg, /&lt;script&gt;/);
  });

  it('draws an accent bar and an outline only when asked', () => {
    assert.equal((renderKeySvg({}).match(/<rect/g) ?? []).length, 1);

    const marked = renderKeySvg({ accent: '#ff0000', outline: '#00ff00' });

    assert.equal((marked.match(/<rect/g) ?? []).length, 3);
  });

  it('holds opacity inside its range', () => {
    assert.match(renderKeySvg({ texts: [{ text: 'x', y: 50, size: 10, opacity: -2 }] }), /opacity="0"/);
    assert.ok(!renderKeySvg({ texts: [{ text: 'x', y: 50, size: 10, opacity: 9 }] }).includes('opacity='));
  });
});

describe('renderKey', () => {
  it('returns an image Stream Deck can draw', () => {
    const image = renderKey({ background: '#000000' });

    assert.ok(image.startsWith('data:image/svg+xml;base64,'));

    const decoded = Buffer.from(image.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8');

    assert.match(decoded, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });
});

describe('fittedSize', () => {
  it('leaves a line that already fits alone', () => {
    assert.equal(fittedSize('0:30', 28), 28);
    assert.equal(fittedSize('JAM', 12, 'bold'), 12);
  });

  it('shrinks a clock that has run past an hour', () => {
    const size = fittedSize('1:00:00', 28);

    assert.ok(size < 28, `expected a smaller size, got ${size}`);
    assert.ok(estimateTextWidth('1:00:00', size) <= 92);
  });

  it('shrinks the longest clock name', () => {
    const size = fittedSize('INTERMISSION', 12, 'bold');

    assert.ok(size < 12, `expected a smaller size, got ${size}`);
    assert.ok(estimateTextWidth('INTERMISSION', size, 'bold') <= 92);
  });

  it('shrinks a long team name', () => {
    const size = fittedSize('Wheels of Justice', 11, 'bold');

    assert.ok(estimateTextWidth('Wheels of Justice', size, 'bold') <= 92);
  });

  it('stops shrinking rather than becoming unreadable', () => {
    assert.equal(fittedSize('x'.repeat(200), 28), 14);
  });

  it('counts bold text as wider than regular', () => {
    assert.ok(estimateTextWidth('PERIOD', 12, 'bold') > estimateTextWidth('PERIOD', 12));
  });
});

describe('long text on a key', () => {
  it('draws an hour-long clock smaller than a short one', () => {
    const short = /font-size="([\d.]+)"/.exec(renderKeySvg({ texts: [{ text: '0:30', y: 62, size: 28 }] }));
    const long = /font-size="([\d.]+)"/.exec(renderKeySvg({ texts: [{ text: '1:00:00', y: 62, size: 28 }] }));

    assert.ok(Number(long?.[1]) < Number(short?.[1]));
    assert.equal(Number(short?.[1]), 28);
  });
});
