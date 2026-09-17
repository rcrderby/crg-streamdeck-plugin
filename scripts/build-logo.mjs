// Draws the plugin icons
//
//     node scripts/build-logo.mjs

import { deflateSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';

const PLUGIN = new URL('../com.rcrderby.crg-streamdeck.sdPlugin/', import.meta.url);

const LOGO = new URL('imgs/plugin/', PLUGIN);

/** Background color */
const PURPLE = [0x6b, 0x00, 0xfc];

/** Top Bar */
const GREEN = [0x22, 0xc5, 0x5e];

/** Dark rule under the bar. */
const RULE = [0x09, 0x09, 0x0b];

const WHITE = [0xff, 0xff, 0xff];

/** Icon shape */
const CORNER = 0.153;

const BAR_HEIGHT = 0.075;

const RULE_HEIGHT = 0.026;

/** Star radius, and where its center sits below the top bar. */
const STAR_RADIUS = 0.305;

const STAR_CENTER_Y = 0.565;

/** How deep a star's inner points cut */
const STAR_WAIST = 0.382;

/** Samples across each pixel for edge smoothing. */
const SAMPLES = 4;

/** The points of a five pointed star, the first one up. */
function starPoints(cx, cy, radius) {
  const points = [];

  for (let index = 0; index < 10; index += 1) {
    const reach = index % 2 === 0 ? radius : radius * STAR_WAIST;
    const angle = (-90 + index * 36) * (Math.PI / 180);

    points.push([cx + reach * Math.cos(angle), cy + reach * Math.sin(angle)]);
  }

  return points;
}

/** True for a point inside a polygon, counting the edges it crosses. */
function inPolygon(points, x, y) {
  let inside = false;

  for (let index = 0, last = points.length - 1; index < points.length; last = index, index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[last];

    if (y1 > y !== y2 > y && x < x1 + ((y - y1) / (y2 - y1)) * (x2 - x1)) {
      inside = !inside;
    }
  }

  return inside;
}

/** True for a point inside a square with rounded corners. */
function inRoundedSquare(side, corner, x, y) {
  if (x < 0 || y < 0 || x > side || y > side) {
    return false;
  }

  const fromLeft = Math.min(x, side - x);
  const fromTop = Math.min(y, side - y);

  if (fromLeft >= corner || fromTop >= corner) {
    return true;
  }

  return (corner - fromLeft) ** 2 + (corner - fromTop) ** 2 <= corner ** 2;
}

/** The color at one point of the icon, or nothing where the key's corners are cut away. */
function colorAt(side, star, x, y) {
  if (!inRoundedSquare(side, side * CORNER, x, y)) {
    return undefined;
  }

  if (y < side * BAR_HEIGHT) {
    return GREEN;
  }

  if (y < side * (BAR_HEIGHT + RULE_HEIGHT)) {
    return RULE;
  }

  return inPolygon(star, x, y) ? WHITE : PURPLE;
}

/** The icon as rows of red, green, blue, and alpha, smoothed by sampling each pixel. */
function draw(side) {
  const star = starPoints(side / 2, side * STAR_CENTER_Y, side * STAR_RADIUS);
  const rows = [];

  for (let down = 0; down < side; down += 1) {
    const row = Buffer.alloc(side * 4);

    for (let across = 0; across < side; across += 1) {
      const total = [0, 0, 0, 0];

      for (let sampleY = 0; sampleY < SAMPLES; sampleY += 1) {
        for (let sampleX = 0; sampleX < SAMPLES; sampleX += 1) {
          const color = colorAt(side, star, across + (sampleX + 0.5) / SAMPLES, down + (sampleY + 0.5) / SAMPLES);

          if (color !== undefined) {
            total[0] += color[0];
            total[1] += color[1];
            total[2] += color[2];
            total[3] += 255;
          }
        }
      }

      const covered = total[3] / 255;
      const offset = across * 4;

      // The color is the average of the samples that landed on the key,
      // so an edge pixel is that color at the share of it it covers.
      row[offset] = covered === 0 ? 0 : Math.round(total[0] / covered);
      row[offset + 1] = covered === 0 ? 0 : Math.round(total[1] / covered);
      row[offset + 2] = covered === 0 ? 0 : Math.round(total[2] / covered);
      row[offset + 3] = Math.round(total[3] / SAMPLES ** 2);
    }

    rows.push(row);
  }

  return rows;
}

/** One PNG chunk: its length, its name, its data, and the checksum of both. */
function chunk(name, data) {
  const head = Buffer.alloc(8);

  head.writeUInt32BE(data.length, 0);
  head.write(name, 4, 'ascii');

  const crc = Buffer.alloc(4);

  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(name, 'ascii'), data])) >>> 0, 0);

  return Buffer.concat([head, data, crc]);
}

const CRC_TABLE = Array.from({ length: 256 }, (_unused, index) => {
  let value = index;

  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function crc32(data) {
  let value = 0xffffffff;

  for (const byte of data) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

/** The icon as PNG bytes, with the transparency the cut corners need. */
function png(side) {
  const header = Buffer.alloc(13);

  header.writeUInt32BE(side, 0);
  header.writeUInt32BE(side, 4);
  header[8] = 8;
  // Color type 6 is red, green, blue, and alpha.
  header[9] = 6;

  // Every row carries the filter byte 0, which means the bytes stand on
  // their own, so the same drawing always deflates to the same bytes.
  const raw = Buffer.concat(draw(side).flatMap((row) => [Buffer.alloc(1), row]));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** The small icon: the star alone, in white, as Stream Deck draws a category. */
function categoryIcon(side = 28) {
  const points = starPoints(side / 2, side / 2, side * 0.44)
    .map(([x, y]) => `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`)
    .join(' L ');

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}" ` +
    `width="${side}" height="${side}" role="img" aria-label="CRG Scoreboard">\n` +
    `  <path d="M ${points} Z" fill="#ffffff"/>\n` +
    `</svg>\n`
  );
}

/** Writes each icon that changed, and reports whether any did. */
export async function buildLogo() {
  const files = [
    ['marketplace.png', png(288)],
    ['marketplace@2x.png', png(576)],
    ['category-icon.svg', Buffer.from(categoryIcon(), 'utf8')]
  ];

  let changed = false;

  for (const [name, bytes] of files) {
    const file = new URL(name, LOGO);
    const existing = await readFile(file).catch(() => undefined);

    if (existing === undefined || !existing.equals(bytes)) {
      await writeFile(file, bytes);
      changed = true;
    }
  }

  return changed;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const changed = await buildLogo();

  process.stdout.write(changed ? `Wrote the plugin icons in ${fileURLToPath(LOGO)}\n` : 'Plugin icons already match\n');
}
