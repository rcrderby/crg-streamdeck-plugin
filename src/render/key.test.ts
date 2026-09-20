import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { BAR_ACTIVE, BAR_INACTIVE, VIEWBOX, estimateTextWidth, fittedSize, renderKey, renderKeySvg } from './key.ts';

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

  it('draws an accent only when asked', () => {
    assert.equal((renderKeySvg({}).match(/<rect/g) ?? []).length, 1);
    assert.equal((renderKeySvg({ accent: '#ff0000' }).match(/<rect/g) ?? []).length, 3, 'the strip and its rule');
  });

  it('holds opacity inside its range', () => {
    assert.match(renderKeySvg({ texts: [{ text: 'x', y: 50, size: 10, opacity: -2 }] }), /opacity="0"/);
    assert.ok(!renderKeySvg({ texts: [{ text: 'x', y: 50, size: 10, opacity: 9 }] }).includes('opacity='));
  });

  it('draws a line of text where it is placed', () => {
    assert.match(renderKeySvg({ texts: [{ text: '1', x: 66, y: 71, size: 30 }] }), /<text x="66" y="71"/);
  });

  it('includes the drawings it is given', () => {
    assert.match(renderKeySvg({ shapes: ['<circle cx="50" cy="50" r="10"/>'] }), /<circle cx="50" cy="50" r="10"\/>/);
  });
});
describe('a line drawn over the veil', () => {
  const spec = {
    background: '#27272a',
    foreground: '#ffffff',
    subdued: true,
    texts: [
      { text: 'Under', y: 40, size: 12 },
      { text: 'Over', y: 80, size: 12, aboveVeil: true }
    ]
  };

  it('is drawn after the veil, and the rest of the key before it', () => {
    const svg = renderKeySvg(spec);
    const veil = svg.indexOf('opacity="0.62"');

    assert.ok(veil > 0, 'the key should carry a veil');
    assert.ok(svg.indexOf('>Under<') < veil, 'the rest of the key stays under the veil');
    assert.ok(svg.indexOf('>Over<') > veil, 'the raised line reads over it');
  });

  it('lands on the same line whether or not the key carries a bar', () => {
    const barred = renderKeySvg({ ...spec, bar: { active: false } });

    assert.equal((barred.match(/translate\(0 4\)/g) ?? []).length, 2, 'both groups move down by the bar');
  });
});

describe('text shadow', () => {
  it('draws a copy of the text in the shadow color, offset down and to the right', () => {
    const svg = renderKeySvg({ texts: [{ text: 'Lead', y: 82, size: 17, shadow: '#000000', color: '#ffffff' }] });
    const lines = [...svg.matchAll(/<text x="([\d.]+)" y="([\d.]+)" fill="(#[0-9a-f]+)"/g)];

    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.[3], '#000000');
    assert.ok(Number(lines[0]?.[1]) > 50 && Number(lines[0]?.[2]) > 82);
    assert.deepEqual([lines[1]?.[1], lines[1]?.[2], lines[1]?.[3]], ['50', '82', '#ffffff']);
  });

  it('draws the shadow beneath the text', () => {
    const svg = renderKeySvg({ texts: [{ text: 'x', y: 50, size: 10, shadow: '#123456', color: '#ffffff' }] });

    assert.ok(svg.indexOf('#123456') < svg.indexOf('fill="#ffffff"'));
  });

  it('drops a shadow whose color is not a hex color', () => {
    const svg = renderKeySvg({ texts: [{ text: 'x', y: 50, size: 10, shadow: 'red"/><script>' }] });

    assert.equal((svg.match(/<text/g) ?? []).length, 1);
    assert.ok(!svg.includes('<script>'));
  });

  it('escapes the shadow copy too', () => {
    const svg = renderKeySvg({ texts: [{ text: '<b>', y: 50, size: 10, shadow: '#000000' }] });

    assert.equal((svg.match(/&lt;b&gt;/g) ?? []).length, 2);
  });
});

describe('top bar', () => {
  it('draws a green bar over a dark rule when active', () => {
    const svg = renderKeySvg({ bar: { active: true } });

    assert.match(svg, new RegExp(`<rect width="100" height="12" fill="${BAR_ACTIVE}"/><rect y="12"`));
  });

  it('draws a gray bar when inactive', () => {
    assert.match(renderKeySvg({ bar: { active: false } }), new RegExp(`fill="${BAR_INACTIVE}"`));
  });

  it('moves the key’s content down to sit below the bar', () => {
    const svg = renderKeySvg({ bar: { active: true }, texts: [{ text: 'Lead', y: 82, size: 17 }] });

    assert.match(svg, /<g transform="translate\(0 4\)"><text/);
  });

  it('leaves content where it is on a key without a bar', () => {
    assert.ok(!renderKeySvg({ texts: [{ text: 'x', y: 50, size: 10 }] }).includes('<g'));
  });
});

describe('accent strip', () => {
  it('stands as tall as the top bar, so every key’s top edge matches', () => {
    const accent = /<rect width="100" height="([\d.]+)" fill="#22c55e"\/>/.exec(
      renderKeySvg({ accent: '#22c55e' })
    )?.[1];
    const bar = /<rect width="100" height="([\d.]+)" fill="#22c55e"\/>/.exec(
      renderKeySvg({ bar: { active: true } })
    )?.[1];

    assert.ok(accent !== undefined);
    assert.equal(accent, bar);
  });

  it('sits over the same dark rule as the top bar', () => {
    assert.match(renderKeySvg({ accent: '#22c55e' }), /<rect y="12" width="100" height="4" fill="#0b0b0f"\/>/);
  });
});

describe('bar label', () => {
  const label = (svg: string): RegExpExecArray | null =>
    /<text x="50" y="[\d.]+" fill="([^"]+)"[^>]*>HOLD<\/text>/.exec(svg);

  it('sets the word white on the gray bar and dark on the green one', () => {
    assert.equal(label(renderKeySvg({ bar: { active: false, label: 'HOLD' } }))?.[1], '#ffffff');
    assert.equal(label(renderKeySvg({ bar: { active: true, label: 'HOLD' } }))?.[1], '#0b0b0f');
  });

  it('splits the word’s color exactly at the edge of a fill running in from the left', () => {
    const svg = renderKeySvg({ bar: { active: false, progress: 0.45, label: 'HOLD' } });

    assert.equal(label(svg)?.[1], 'url(#bar-label)');
    assert.match(svg, /<stop offset="45%" stop-color="#0b0b0f"\/><stop offset="45%" stop-color="#ffffff"\/>/);
  });

  it('splits it where the gray starts, while a bar empties from the right', () => {
    const svg = renderKeySvg({ bar: { active: true, progress: 0.3, label: 'HOLD' } });

    assert.match(svg, /<stop offset="70%" stop-color="#0b0b0f"\/><stop offset="70%" stop-color="#ffffff"\/>/);
  });

  it('draws the word over the bar, and nothing without a label', () => {
    const svg = renderKeySvg({ bar: { active: false, label: 'HOLD' } });

    assert.ok(svg.indexOf('>HOLD<') > svg.indexOf('height="12"'));
    assert.doesNotMatch(renderKeySvg({ bar: { active: false } }), /HOLD|linearGradient/);
  });
});

describe('page mark', () => {
  it('draws the page tab only when asked', () => {
    assert.doesNotMatch(renderKeySvg({}), /scale\(-1 1\)/);
    assert.match(renderKeySvg({ opensPage: true }), /<g transform="translate\(100 0\) scale\(-1 1\)">/);
  });

  it('mirrors the informational tab into the lower right, in the same blue', () => {
    const svg = renderKeySvg({ opensPage: true });

    assert.match(
      svg,
      /scale\(-1 1\)"><path d="M 0 78\.8 [^"]*" fill="#0b0b0f"\/><path d="M 0 80\.8 [^"]*" fill="#3d5a8a"\/>/
    );
  });

  it('draws a white chevron pointing right inside the tab', () => {
    const svg = renderKeySvg({ opensPage: true });
    const found =
      /<path d="M ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+) L ([\d.]+) ([\d.]+)" fill="none" stroke="#ffffff"/.exec(svg);

    assert.ok(found !== null);

    const [backX, topY, tipX, tipY, , bottomY] = found.slice(1).map(Number) as number[];

    assert.ok((tipX ?? 0) > (backX ?? 0), 'the tip should be to the right');
    assert.ok((backX ?? 0) > 100 - 19.2, 'the chevron should sit inside the tab');
    assert.ok((topY ?? 0) < (tipY ?? 0) && (tipY ?? 0) < (bottomY ?? 0));
  });
});

describe('informational mark', () => {
  it('draws the informational tab only when asked', () => {
    assert.ok(!renderKeySvg({}).includes('#3d5a8a'));
    assert.match(
      renderKeySvg({ informational: true }),
      /<path d="M 0 80.8 H 13.6 A 5.6 5.6 0 0 1 19.2 86.4 V 100 H 0 Z" fill="#3d5a8a"\/>/
    );
  });

  it('sets the tab apart with a dark rule drawn beneath it', () => {
    const svg = renderKeySvg({ informational: true });
    const rule = svg.indexOf('<path d="M 0 78.8 H 13.6 A 7.6 7.6 0 0 1 21.2 86.4 V 100 H 0 Z" fill="#0b0b0f"/>');

    assert.ok(rule !== -1 && rule < svg.indexOf('fill="#3d5a8a"'));
  });

  it('centers a white "i" in the tab', () => {
    assert.match(
      renderKeySvg({ informational: true }),
      /<g transform="translate\(7\.15 83\.45\) scale\(0\.12\)" fill="#ffffff">/
    );
  });
});

describe('subdued', () => {
  it('draws a dark veil over everything else on the key', () => {
    const svg = renderKeySvg({ informational: true, subdued: true, texts: [{ text: 'x', y: 50, size: 10 }] });

    assert.ok(svg.endsWith('<rect width="100" height="100" fill="#000000" opacity="0.62"/></svg>'));
  });

  it('draws no veil unless asked', () => {
    assert.ok(!renderKeySvg({}).includes('opacity="0.62"'));
  });
});

describe('renderKey', () => {
  it('returns an image Stream Deck can draw', () => {
    const image = renderKey({ background: '#000000' });

    assert.ok(image.startsWith('data:image/svg+xml;base64,'));

    const decoded = Buffer.from(image.slice('data:image/svg+xml;base64,'.length), 'base64').toString('utf8');

    assert.match(decoded, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('uses nothing Stream Deck’s renderer ignores', () => {
    const svg = renderKeySvg({
      bar: { active: true },
      informational: true,
      subdued: true,
      texts: [{ text: 'Lead', y: 82, size: 17, shadow: '#000000' }]
    });

    assert.ok(!/<filter|clip-path|mask=/.test(svg));
  });
});

describe('estimateTextWidth', () => {
  it('counts wide script and emoji as a full em each, so a name in them still fits', () => {
    assert.equal(estimateTextWidth('東京', 10), 20);
    assert.equal(estimateTextWidth('🛼🛼', 10), 20);
    assert.ok(fittedSize('ローズシティローラーズ', 11, 'bold') < 11);
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

  it('keeps the jammer captions at one size', () => {
    for (const caption of ['Lead', 'Lost Lead', 'Star Pass', 'No Pivot']) {
      assert.equal(fittedSize(caption, 17, 'bold'), 17, caption);
    }
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
