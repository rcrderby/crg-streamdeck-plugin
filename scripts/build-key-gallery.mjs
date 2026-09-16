// Draws the README's key gallery from the same designs the plugin draws,
// so the picture cannot drift from what a deck shows.
//
//     node scripts/build-key-gallery.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = fileURLToPath(new URL('docs/images/key-gallery.svg', ROOT));

const { renderKeySvg, VIEWBOX } = await import('../src/render/key.ts');
const d = await import('../src/render/designs.ts');

/** Two teams whose colors are as far apart as a league's usually are. */
const WHEELS = { background: '#38205b', foreground: '#ffffff', glow: '#000000', name: 'Wheels' };
const JUSTICE = { background: '#ffffff', foreground: '#38205b', glow: '#cbd5e1', name: 'Justice' };

/**
 * A Stream Deck XL mid jam, laid out the way an operator works a game.
 *
 * Every value is one CRG holds during a real jam, so the picture shows
 * the keys reading a game rather than a set of samples.
 */
const KEYS = [
  [
    d.jammerKey(WHEELS, 'lead', false),
    d.lostLeadKey(WHEELS, true),
    d.scoreKey(WHEELS, 113, 0, 1),
    d.jamControlKey('Stop Jam', '1:04', 'JAM 13', d.JAM_STOP, false),
    d.clockKey('PERIOD 2', '12:26', true),
    d.scoreKey(JUSTICE, 109, 4, 3),
    d.lostLeadKey(JUSTICE, false),
    d.jammerKey(JUSTICE, 'lead', true)
  ],
  [
    d.noInitialKey(WHEELS, true),
    d.teamTimeoutKey(WHEELS, 3, 2, false),
    d.officialReviewKey(WHEELS, 1, 1, undefined, false),
    d.timeoutKey(['Official', 'Timeout'], false),
    d.timeoutKey(['Timeout'], false),
    d.officialReviewKey(JUSTICE, 1, 1, undefined, false),
    d.teamTimeoutKey(JUSTICE, 3, 1, false),
    d.noInitialKey(JUSTICE, false)
  ],
  [
    d.jammerKey(WHEELS, 'starPass', true),
    d.tripAdjustKey(WHEELS, true),
    d.tripAdjustKey(WHEELS, false),
    d.undoKey(),
    d.connectionKey('connected', 'StreamDeck'),
    d.tripAdjustKey(JUSTICE, false),
    d.tripAdjustKey(JUSTICE, true),
    d.jammerKey(JUSTICE, 'starPass', false)
  ],
  [
    d.tripPointsKey(WHEELS, 4),
    d.tripPointsKey(WHEELS, 3),
    d.tripPointsKey(WHEELS, 2),
    d.tripPointsKey(WHEELS, 1),
    d.tripPointsKey(JUSTICE, 1),
    d.tripPointsKey(JUSTICE, 2),
    d.tripPointsKey(JUSTICE, 3),
    d.tripPointsKey(JUSTICE, 4)
  ]
];

/** Bezel around the keys, and the gap between them, in key units. */
const GAP = 14;
const EDGE = 20;
const RADIUS = 10;

const columns = KEYS[0].length;
const rows = KEYS.length;
const width = EDGE * 2 + columns * VIEWBOX + (columns - 1) * GAP;
const height = EDGE * 2 + rows * VIEWBOX + (rows - 1) * GAP;

const keys = KEYS.flatMap((row, down) =>
  row.map((spec, across) => {
    const x = EDGE + across * (VIEWBOX + GAP);
    const y = EDGE + down * (VIEWBOX + GAP);
    const inner = renderKeySvg(spec)
      .replace(/^<svg[^>]*>/, '')
      .replace(/<\/svg>$/, '');

    return (
      `<svg x="${x}" y="${y}" width="${VIEWBOX}" height="${VIEWBOX}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">` +
      `<rect width="${VIEWBOX}" height="${VIEWBOX}" rx="${RADIUS}" fill="#000000"/>` +
      `<g clip-path="inset(0 round ${RADIUS}px)">${inner}</g>` +
      `</svg>`
    );
  })
);

const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" ` +
  `role="img" aria-label="A Stream Deck XL running the plugin's keys during a jam">` +
  `<rect width="${width}" height="${height}" rx="${EDGE}" fill="#000000"/>` +
  keys.join('') +
  `</svg>\n`;

mkdirSync(fileURLToPath(new URL('docs/images/', ROOT)), { recursive: true });
writeFileSync(OUTPUT, svg);
console.log(`wrote ${OUTPUT} (${columns} by ${rows} keys, ${svg.length} bytes)`);
