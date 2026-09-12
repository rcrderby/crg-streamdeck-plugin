import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { VIEWBOX, renderKey, renderKeySvg } from './key.ts';

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
    assert.match(svg, /fill="#111111"/);
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
