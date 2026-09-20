/**
 * The drawings on the keys, as SVG markup in the 100 unit viewBox.
 *
 * Stream Deck's renderer ignores filters and does not apply clip paths
 * or masks, so every drawing is plain shapes, paths, strokes, and
 * opacity. A stripe is a path cut to its circle, and a struck icon draws
 * its bar between exact end points.
 *
 * Every color passes through safeColor, so a value that is not a hex
 * color never reaches the markup.
 */

import { safeColor } from './theme.ts';

/** Jammer icons share one circle, center, and stroke, so they read as a family. */
export const ICON_CENTER_Y = 38;

export const ICON_RADIUS = 21;

const STROKE = 3;

/** How far a struck icon's bar parts the drawing beneath it, on each side. */
const SLASH_GAP = 3;

/** A resource dot's radius. */
const DOT_RADIUS = 3.4;

/** More dots than any rule set gives a team, and more than a key has room for. */
const MAX_DOTS = 12;

/** A resource mark's opacity once the key has nothing left. */
const SPENT_OPACITY = 0.38;

/** How far a drawing's shadow sits down and to the right of it. */
const SHADOW_OFFSET = 0.6;

/** The mark on an Official Review key that a team won: a plus once, a line twice. */
export type ReviewMark = 'retained' | 'twice';

function n(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function hex(color: string): string {
  return safeColor(color, '#ffffff');
}

/**
 * A drawing with a shadow in a glow color, as a text shadow is drawn.
 *
 * The copy behind it takes the glow for every color it holds, so a
 * drawing with a cut out part casts one solid shadow. A solid shadow
 * also drops the drawing's opacity, so a part drawn faded on purpose
 * still gets a clear edge. With no glow, the drawing comes back as it was.
 */
export function shadowed(markup: string, glow: string | undefined, solid = false): string {
  const color = safeColor(glow, '');

  if (color === '') {
    return markup;
  }

  const recolored = markup.replace(/(fill|stroke)="#[0-9a-f]{6}"/gi, `$1="${color}"`);
  const copy = solid ? recolored.replace(/ opacity="[\d.]+"/g, '') : recolored;

  return `<g transform="translate(${SHADOW_OFFSET} ${SHADOW_OFFSET})">${copy}</g>${markup}`;
}

function opacityAttribute(opacity: number): string {
  return opacity < 1 ? ` opacity="${n(opacity)}"` : '';
}

/** A regular five point star, moved down a little so it sits centered to the eye. */
export function star(cx: number, cy: number, radius: number, color: string, opacity = 1): string {
  const inner = radius * 0.382;
  const y = cy + (radius * (1 - Math.cos(Math.PI / 5))) / 2;
  const points: string[] = [];

  for (let index = 0; index < 10; index += 1) {
    const reach = index % 2 === 0 ? radius : inner;
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;

    points.push(`${n(cx + reach * Math.cos(angle))},${n(y + reach * Math.sin(angle))}`);
  }

  const fill = hex(color);

  return (
    `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${fill}" stroke-width="0.6" ` +
    `stroke-linejoin="round"${opacityAttribute(opacity)}/>`
  );
}

export function ring(cx: number, cy: number, radius: number, color: string, width = STROKE): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius)}" fill="none" stroke="${hex(color)}" stroke-width="${n(width)}"/>`;
}

/** The pivot's stripe, as one path whose ends follow the inside of its circle. */
export function stripe(cx: number, cy: number, radius: number, color: string, opacity = 1, width = STROKE): string {
  const inner = radius - width / 2;
  const half = radius * 0.26;
  const rise = Math.sqrt(inner * inner - half * half);

  return (
    `<path d="M ${n(cx - half)} ${n(cy - rise)} A ${n(inner)} ${n(inner)} 0 0 1 ${n(cx + half)} ${n(cy - rise)} ` +
    `L ${n(cx + half)} ${n(cy + rise)} A ${n(inner)} ${n(inner)} 0 0 1 ${n(cx - half)} ${n(cy + rise)} Z" ` +
    `fill="${hex(color)}"${opacityAttribute(opacity)}/>`
  );
}

/**
 * A circled drawing with a diagonal bar, like a prohibition sign.
 *
 * The bar ends exactly on the inside of the ring, over a wider line in
 * the key's background that parts the drawing beneath it. The ring is
 * drawn last, so it stays whole.
 */
function struck(
  color: string,
  background: string,
  content: string,
  gap = SLASH_GAP,
  cy = ICON_CENTER_Y,
  radius = ICON_RADIUS,
  width = STROKE
): string {
  const inner = radius - width / 2;
  const reach = inner / Math.SQRT2;
  const line = `x1="${n(50 - reach)}" y1="${n(cy + reach)}" x2="${n(50 + reach)}" y2="${n(cy - reach)}"`;

  return (
    content +
    `<line ${line} stroke="${hex(background)}" stroke-width="${n(width + gap * 2)}"/>` +
    `<line ${line} stroke="${hex(color)}" stroke-width="${n(width)}"/>` +
    ring(50, cy, radius, color, width)
  );
}

/** Lead: a star inside a circle. */
export function leadIcon(color: string, cx = 50, cy = ICON_CENTER_Y, radius = ICON_RADIUS, width = STROKE): string {
  return ring(cx, cy, radius, color, width) + star(cx, cy, radius * 0.6, color);
}

/** Where the Lost Lead drawing sits, drawn smaller than the other jammer icons to leave room for its hold caption. */
export const LOST_LEAD_RADIUS = 16;

export const LOST_LEAD_CENTER_Y = 34;

/** How far the Lead drawing reaches above and below its center, stroke included, at full size. */
export const ICON_REACH = ICON_RADIUS + STROKE / 2;

/** The radius of the disc on Add Trip and Remove Trip. */
export const TRIP_SIGN_RADIUS = 17;

/** Lost Lead: the lead icon struck through, its star large enough to read in two halves. */
export function lostLeadIcon(
  color: string,
  background: string,
  cy = LOST_LEAD_CENTER_Y,
  radius = LOST_LEAD_RADIUS
): string {
  const scale = radius / ICON_RADIUS;

  return struck(color, background, star(50, cy, radius * 0.68, color), 1.2 * scale, cy, radius, STROKE * scale);
}

/** A circle with a vertical stripe: the pivot's helmet cover. */
export function pivotIcon(color: string, cx = 50, cy = ICON_CENTER_Y, radius = ICON_RADIUS, width = STROKE): string {
  return stripe(cx, cy, radius, color, 1, width) + ring(cx, cy, radius, color, width);
}

/** No Pivot: the pivot icon with its stripe dimmed, struck through. */
export function noPivotIcon(color: string, background: string): string {
  return struck(color, background, stripe(50, ICON_CENTER_Y, ICON_RADIUS, color, 0.45));
}

/** How finely the arrowhead's angle is searched for. */
const HEAD_STEPS = 40;

/**
 * The direction to set an arrowhead about, so a curving line leaves the same gap under each arm.
 *
 * Set about the tangent where the line ends, the arm inside the bend
 * sits nearer the line than the one outside it. The turn that evens them
 * has no neat form, so it is found by halving the range it lies in: the
 * two arms are level when their distances from the arc cancel.
 */
function evenHeadAxis(
  cx: number,
  cy: number,
  tipX: number,
  tipY: number,
  radius: number,
  size: number,
  spread: number
): [number, number] {
  const tip = Math.atan2(tipY - cy, tipX - cx);

  const axisAt = (turn: number): [number, number] => {
    const angle = tip + Math.PI / 2 + turn;

    return [Math.cos(angle), Math.sin(angle)];
  };

  const imbalance = (turn: number): number => {
    const [ux, uy] = axisAt(turn);

    return [1, -1].reduce((total, sign) => {
      const cos = Math.cos(sign * spread);
      const sin = Math.sin(sign * spread);
      const px = tipX - (ux * cos - uy * sin) * size;
      const py = tipY - (ux * sin + uy * cos) * size;

      return total + (Math.hypot(px - cx, py - cy) - radius);
    }, 0);
  };

  let low = -0.5;
  let high = 0.5;

  for (let step = 0; step < HEAD_STEPS; step += 1) {
    const middle = (low + high) / 2;

    if (imbalance(low) * imbalance(middle) <= 0) {
      high = middle;
    } else {
      low = middle;
    }
  }

  return axisAt((low + high) / 2);
}

/**
 * Star Pass: the circled star, an arrow arcing over the gap, and the
 * pivot's circle.
 *
 * The arrow is a true circular arc, and its head is an open chevron in
 * the same stroke, set about the angle that leaves the arc the same gap
 * under each arm rather than about the tangent where it ends.
 */
export function starPassIcon(color: string): string {
  const radius = 13;
  const width = 2.6;
  const left = 21;
  const right = 79;
  const start = left + radius + 4;
  const end = right - radius - 4;
  const y = ICON_CENTER_Y - 3;
  const chord = end - start;
  const sag = 6;
  const arcRadius = (chord * chord) / 4 + sag * sag;
  const bend = arcRadius / (2 * sag);
  const centerX = (start + end) / 2;
  const centerY = y - sag + bend;
  const size = 6;
  const spread = (40 * Math.PI) / 180;

  const [directionX, directionY] = evenHeadAxis(centerX, centerY, end, y, bend, size, spread);

  const arm = (sign: number): string => {
    const cos = Math.cos(sign * spread);
    const sin = Math.sin(sign * spread);
    const backX = -(directionX * cos - directionY * sin);
    const backY = -(directionX * sin + directionY * cos);

    return `${n(end + backX * size)},${n(y + backY * size)}`;
  };

  const stroke = `fill="none" stroke="${hex(color)}" stroke-width="${width}" stroke-linecap="round"`;

  return (
    leadIcon(color, left, ICON_CENTER_Y, radius, width) +
    `<path d="M ${start} ${n(y)} A ${n(bend)} ${n(bend)} 0 0 1 ${end} ${n(y)}" ${stroke}/>` +
    `<path d="M ${arm(1)} L ${end} ${n(y)} L ${arm(-1)}" ${stroke} stroke-linejoin="round"/>` +
    pivotIcon(color, right, ICON_CENTER_Y, radius, width)
  );
}

/** A medical cross. */
export function medicalCross(cx: number, cy: number, size: number, color: string): string {
  const thickness = size * 0.34;
  const corner = n(thickness * 0.22);
  const fill = hex(color);

  return (
    `<rect x="${n(cx - thickness / 2)}" y="${n(cy - size / 2)}" width="${n(thickness)}" height="${n(size)}" rx="${corner}" fill="${fill}"/>` +
    `<rect x="${n(cx - size / 2)}" y="${n(cy - thickness / 2)}" width="${n(size)}" height="${n(thickness)}" rx="${corner}" fill="${fill}"/>`
  );
}

/**
 * Undo: a U turn heading back to the left.
 *
 * From an arrowhead pointing left, the line runs right along the top,
 * turns down around a half circle, and comes back left along the
 * bottom. The radius is half the arrow's width.
 */
export function undoArrow(cx: number, cy: number, radius: number, color: string): string {
  const turn = radius * 0.62;
  const top = cy - turn;
  const bottom = cy + turn;
  const tip = cx - radius;
  const bend = cx + radius - turn;
  const tail = cx - radius * 0.3;
  const head = radius * 0.44;
  const stroke = `fill="none" stroke="${hex(color)}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"`;

  return (
    `<path d="M ${n(tip)} ${n(top)} H ${n(bend)} A ${n(turn)} ${n(turn)} 0 0 1 ${n(bend)} ${n(bottom)} H ${n(tail)}" ${stroke}/>` +
    `<path d="M ${n(tip + head)} ${n(top - head)} L ${n(tip)} ${n(top)} L ${n(tip + head)} ${n(top + head)}" ${stroke}/>`
  );
}

/** Hazard striping across the whole key, faint enough to sit behind a drawing. */
/** The key's own box, which the renderer draws these into. */
const VIEWBOX = 100;

/** How far apart the hairlines run, and how strongly they are drawn. */
const HAIRLINE_GAP = 16;

const HAIRLINE_OPACITY = 0.16;

/** Fine diagonal hairlines across a key. */

export function hairlines(color = '#ffffff'): string {
  const lines: string[] = [];

  for (let index = 0; index * HAIRLINE_GAP < VIEWBOX * 2; index += 1) {
    const x = -VIEWBOX + index * HAIRLINE_GAP;

    lines.push(`<path d="M ${x} ${VIEWBOX} L ${x + VIEWBOX} 0"/>`);
  }

  return `<g opacity="${HAIRLINE_OPACITY}" stroke="${hex(color)}" stroke-width="1">${lines.join('')}</g>`;
}

export function hazardStripes(color: string): string {
  const stripes: string[] = [];

  for (let index = 0; index < 10; index += 1) {
    stripes.push(
      `<rect x="${-20 + index * 16}" y="-20" width="7" height="150" fill="${hex(color)}" opacity="0.12" transform="rotate(30 50 50)"/>`
    );
  }

  return stripes.join('');
}

/**
 * The dial a held key shows: a ring whose inside fills clockwise as the hold goes on.
 *
 * Nothing is drawn before the key is held. It sits on a disc in the key's
 * background, so it reads over whatever is beneath it.
 */
export function holdDial(level: number, color: string, backing: string, cx = 82, cy = 21, radius = 8): string {
  if (level <= 0) {
    return '';
  }

  const ink = hex(color);
  const inner = radius - 2.5;
  const dial =
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius + 3.5)}" fill="${hex(backing)}"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(radius)}" fill="none" stroke="${ink}" stroke-width="2"/>`;

  if (level >= 1) {
    return dial + `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(inner)}" fill="${ink}"/>`;
  }

  const angle = 2 * Math.PI * level;
  const x = cx + inner * Math.sin(angle);
  const y = cy - inner * Math.cos(angle);

  return (
    dial +
    `<path d="M ${n(cx)} ${n(cy)} L ${n(cx)} ${n(cy - inner)} ` +
    `A ${n(inner)} ${n(inner)} 0 ${level > 0.5 ? 1 : 0} 1 ${n(x)} ${n(y)} Z" fill="${ink}"/>`
  );
}

/** Back: an arrow pointing left. */
export function backArrow(cx: number, cy: number, radius: number, color: string): string {
  const stroke = `fill="none" stroke="${hex(color)}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;

  return (
    `<path d="M ${n(cx + radius)} ${n(cy)} H ${n(cx - radius + 3)}" ${stroke}/>` +
    `<path d="M ${n(cx - radius * 0.15)} ${n(cy - radius * 0.8)} L ${n(cx - radius)} ${n(cy)} ` +
    `L ${n(cx - radius * 0.15)} ${n(cy + radius * 0.8)}" ${stroke}/>`
  );
}

/** A solid rounded panel, set behind a word so it reads over a drawing. */
export function plate(x: number, y: number, width: number, height: number, color: string, radius = 4): string {
  return (
    `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" ` +
    `rx="${n(radius)}" fill="${hex(color)}"/>`
  );
}

/** A solid triangle, pointing up or down. */
export function triangle(up: boolean, cx: number, cy: number, width: number, color: string): string {
  const height = width * 0.8;
  const tipY = up ? cy - height / 2 : cy + height / 2;
  const baseY = up ? cy + height / 2 : cy - height / 2;

  return `<polygon points="${n(cx)},${n(tipY)} ${n(cx - width / 2)},${n(baseY)} ${n(cx + width / 2)},${n(baseY)}" fill="${hex(color)}"/>`;
}

/** Add Trip or Remove Trip: a filled disc with a plus or a minus cut out of it. */
export function tripSign(add: boolean, foreground: string, background: string, cy = 53): string {
  const cx = 50;
  const radius = TRIP_SIGN_RADIUS;
  const arm = radius * 0.5;
  const cap = `stroke="${hex(background)}" stroke-width="3.6" stroke-linecap="butt"`;
  const vertical = add ? `<line x1="${cx}" y1="${n(cy - arm)}" x2="${cx}" y2="${n(cy + arm)}" ${cap}/>` : '';

  return (
    `<circle cx="${cx}" cy="${n(cy)}" r="${radius}" fill="${hex(foreground)}"/>` +
    `<line x1="${n(cx - arm)}" y1="${n(cy)}" x2="${n(cx + arm)}" y2="${n(cy)}" ${cap}/>` +
    vertical
  );
}

/** A review mark where its dot would be: a plus once won, a line once won twice. */
function reviewMark(mark: ReviewMark, cx: number, cy: number, color: string, opacity: number): string {
  const half = 5;
  const cap = `stroke="${hex(color)}" stroke-width="2.8" stroke-linecap="round"${opacityAttribute(opacity)}`;
  const vertical = `<line x1="${n(cx)}" y1="${n(cy - half)}" x2="${n(cx)}" y2="${n(cy + half)}" ${cap}/>`;

  if (mark === 'twice') {
    return vertical;
  }

  return vertical + `<line x1="${n(cx - half)}" y1="${n(cy)}" x2="${n(cx + half)}" y2="${n(cy)}" ${cap}/>`;
}

/**
 * What a team has left, as dots: filled while left, a faint outline once spent.
 *
 * A review mark takes the place of the last dot. A key with nothing
 * left is subdued, and its mark with it. While the team's timeout or
 * review runs, the mark it used pulses at the given opacity: CRG has
 * already counted it, so it is the one at the position of the count left.
 *
 * The count comes from a CRG rule, which an operator types, so it is
 * read as a whole number and held inside what a key has room for.
 */
export function resourceDots(
  total: number,
  left: number,
  color: string,
  y = 80,
  mark?: ReviewMark,
  pulse?: number
): string {
  const count = Math.min(MAX_DOTS, Math.max(0, Math.floor(total) || 0));
  const gap = DOT_RADIUS * 3.3;
  const start = 50 - ((count - 1) * gap) / 2;
  const fill = hex(color);
  const dots: string[] = [];

  for (let index = 0; index < count; index += 1) {
    const cx = start + index * gap;
    const pulsing = pulse !== undefined && index === left ? pulse : undefined;

    if (mark !== undefined && index === count - 1) {
      dots.push(reviewMark(mark, cx, y, color, pulsing ?? (left === 0 ? SPENT_OPACITY : 1)));
    } else if (index < left || pulsing !== undefined) {
      dots.push(
        `<circle cx="${n(cx)}" cy="${n(y)}" r="${DOT_RADIUS}" fill="${fill}"${opacityAttribute(pulsing ?? 1)}/>`
      );
    } else {
      dots.push(
        `<circle cx="${n(cx)}" cy="${n(y)}" r="${DOT_RADIUS}" fill="none" stroke="${fill}" stroke-width="1.3" opacity="0.35"/>`
      );
    }
  }

  return dots.join('');
}
