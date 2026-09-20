/**
 * Draws a key as an SVG image.
 *
 * The drawing is written in a square viewBox rather than in pixels, so
 * one description fits every Stream Deck model: the hardware scales it
 * to whatever its keys are. Text arriving from CRG is escaped on the
 * way in, and colors are used only once they read as hex colors.
 *
 * Stream Deck's renderer ignores SVG filters and does not apply clip
 * paths or masks, so a text shadow is the text drawn twice and
 * every other effect is plain shapes and opacity.
 */

import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND, contrastRatio, escapeXml, safeColor } from './theme.ts';

/** The side of the square everything is positioned within. */
export const VIEWBOX = 100;

/** A line of text on a key. */
export type KeyText = {
  readonly text: string;
  /** Baseline, from the top of the viewBox. */
  readonly y: number;
  readonly size: number;
  /** Center, from the left of the viewBox; the middle when omitted. */
  readonly x?: number | undefined;
  readonly weight?: 'normal' | 'bold' | undefined;
  readonly italic?: boolean | undefined;
  /** Room the line has to fill, for text set into a box rather than across the key. */
  readonly width?: number | undefined;
  readonly color?: string | undefined;
  readonly opacity?: number | undefined;
  /** A glow color, drawn as a copy of the text offset down and to the right. */
  readonly shadow?: string | undefined;
  /**
   * Whether the line is drawn over the veil rather than under it.
   *
   * A subdued key says it cannot be used, and one line on it may still
   * carry something worth reading, such as how long the wait has left.
   */
  readonly aboveVeil?: boolean | undefined;
};

/** The bar across the top of a key that can be active. */
export type KeyBar = {
  readonly active: boolean;
  /**
   * How far a hold on this key has gone, from 0 to 1.
   *
   * The bar carries the hold, so a key on a team color needs no dial
   * competing with its background.
   */
  readonly progress?: number | undefined;
  /**
   * What the hold fills the bar with.
   *
   * 'next', the default, fills in the color the bar is about to take: a
   * key turning itself on fills green from the left, and one turning
   * itself off empties gray from the right. 'active' always fills green
   * from the left, for a key whose hold leaves the bar where it is.
   * 'danger' fills red from the left, for a hold that cuts something off
   * or cannot be taken back.
   */
  readonly fill?: 'next' | 'active' | 'danger' | undefined;
  /**
   * A word set in the middle of the bar, such as HOLD.
   *
   * Each part of it is drawn dark or white against the color behind that
   * part, so as a hold fills the bar the word changes color right at the
   * fill's edge, even partway through a letter.
   */
  readonly label?: string | undefined;
};

/** Everything drawn on one key. */
export type KeySpec = {
  readonly background?: string | undefined;
  readonly foreground?: string | undefined;
  /** A thin strip across the top, used by the clocks and the CRG Connection key. */
  readonly accent?: string | undefined;
  /** Drawings from icons.ts, which build their markup only from checked colors. */
  readonly shapes?: readonly string[] | undefined;
  readonly texts?: readonly KeyText[] | undefined;
  /** The active bar; the rest of the key moves down to sit below it. */
  readonly bar?: KeyBar | undefined;
  /** The corner tab with an "i", on a key that does nothing when pressed. */
  readonly informational?: boolean | undefined;
  /** The same tab in the lower right corner with a chevron, on a key that opens a page of more keys. */
  readonly opensPage?: boolean | undefined;
  /** A dark veil over the whole key, while CRG is disconnected or the key has nothing to act on. */
  readonly subdued?: boolean | undefined;
};

const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export const BAR_ACTIVE = '#22c55e';

export const BAR_INACTIVE = '#52525b';

export const BAR_DANGER = '#ef4444';

const BAR_HEIGHT = 12;

/** The clock and connection keys' colored strip, as tall as the top bar and over the same dark rule, so every key's top edge matches. */
const ACCENT_HEIGHT = BAR_HEIGHT;

/** The dark rule under the bar, which keeps it apart from a team color close to its own. */
const BAR_RULE_HEIGHT = 4;

/** A word set in the bar: its size, the room between its letters, and the dark it takes over a light bar. */
const BAR_LABEL_SIZE = 9;

const BAR_LABEL_SPACING = 0.6;

const BAR_LABEL_DARK = '#0b0b0f';

const BAR_RULE_COLOR = '#0b0b0f';

/** How far a key's content moves down to center on the area below the bar. */
export const BAR_SHIFT = 4;

/** A text shadow's offset, as a share of the font size. */
const SHADOW_OFFSET = 0.02;

const SHADOW_MIN_OFFSET = 0.4;

const MARK_FILL = '#3d5a8a';

/** How far the informational tab reaches in from the key's left and bottom edges. */
const MARK_SIZE = 19.2;

const MARK_CORNER = 5.6;

/** The dark rule that sets the tab apart from a background of its own blue. */
const MARK_RULE = 2;

const MARK_RULE_COLOR = '#0b0b0f';

/** Where the "i" is centered, and how tall it is drawn. */
const MARK_GLYPH_X = 9.55;

const MARK_GLYPH_Y = 89.45;

const MARK_GLYPH_HEIGHT = 12;

/**
 * An italic "i" in a box 40 wide and 100 tall: a round dot set right, and a
 * stem with a slanted flag at its top and a foot that sweeps right.
 */
const MARK_GLYPH_WIDTH = 40;

const MARK_GLYPH_DOT = '<circle cx="28.5" cy="11" r="10.8"/>';

const MARK_GLYPH_STEM =
  'M 0.5 45 L 0 40.5 C 11 37.5 21 34 31 31 L 33 32 L 23.5 77 C 22.8 81 24.3 82.5 27 80.5 L 37.5 74.5 L 38.5 78.5 ' +
  'C 30 87 22 94.5 13.5 96 C 7.5 97 5 93 6 88 L 14.5 51 C 15.2 47 13 45.5 10 46 Z';

/** The page mark's chevron: how far its arms reach from its tip, across and up or down, and its stroke. */
const CHEVRON_REACH_X = 4;

const CHEVRON_REACH_Y = 4.25;

const CHEVRON_STROKE = 2.3;

const VEIL_OPACITY = 0.62;

/** Room a line of text is given, leaving a margin at each edge. */
const TEXT_WIDTH = 92;

/** How small a line may be shrunk before it stops being worth reading. */
const MIN_FONT_SCALE = 0.5;

/** Characters drawn about a full em wide: Chinese, Japanese, and Korean script, and emoji. */
const WIDE = /[\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60\uffe0-\uffe6]|\p{Extended_Pictographic}/u;

/**
 * Rough character widths, as a fraction of the font size.
 *
 * Enough to tell whether a line will overflow. The renderer has no font
 * metrics, and the exact figures differ per device anyway, so the aim
 * is a size that fits rather than one that fills the key precisely.
 */
function characterWidth(character: string): number {
  if (WIDE.test(character)) {
    return 1;
  }

  if (":.,'| ".includes(character)) {
    return 0.28;
  }

  if (character >= '0' && character <= '9') {
    return 0.56;
  }

  if (character >= 'A' && character <= 'Z') {
    return 0.68;
  }

  if (character >= 'a' && character <= 'z') {
    return 0.52;
  }

  return 0.6;
}

/** Estimates how wide a line will be drawn, in viewBox units. */
export function estimateTextWidth(text: string, size: number, weight: 'normal' | 'bold' = 'normal'): number {
  const ems = [...text].reduce((total, character) => total + characterWidth(character), 0);

  return ems * size * (weight === 'bold' ? 1.06 : 1);
}

/**
 * Shrinks a line until it fits the room it is given.
 *
 * Returns the size unchanged when the line already fits.
 */
export function fittedSize(
  text: string,
  size: number,
  weight: 'normal' | 'bold' = 'normal',
  width = TEXT_WIDTH
): number {
  const estimated = estimateTextWidth(text, size, weight);

  if (estimated <= width) {
    return size;
  }

  return Math.max(size * MIN_FONT_SCALE, (size * width) / estimated);
}

/** Keeps the generated markup short, and comparable between redraws. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function text(line: KeyText, foreground: string): string {
  const weight = line.weight === 'bold' ? 700 : 400;
  const fill = safeColor(line.color, foreground);
  const opacity = line.opacity !== undefined && line.opacity < 1 ? ` opacity="${clamp(line.opacity)}"` : '';
  const size = round(fittedSize(line.text, line.size, line.weight ?? 'normal', line.width));
  const x = line.x ?? VIEWBOX / 2;
  const content = escapeXml(line.text);
  const style = line.italic === true ? ' font-style="italic"' : '';
  const common =
    `font-family="${FONT_STACK}" font-size="${size}" font-weight="${weight}" ` +
    `text-anchor="middle"${style}${opacity}`;
  const shadowColor = safeColor(line.shadow, '');

  const shadow =
    shadowColor === ''
      ? ''
      : (() => {
          const offset = round(Math.max(SHADOW_MIN_OFFSET, size * SHADOW_OFFSET));

          return `<text x="${round(x + offset)}" y="${round(line.y + offset)}" fill="${shadowColor}" ${common}>${content}</text>`;
        })();

  return `${shadow}<text x="${round(x)}" y="${round(line.y)}" fill="${fill}" ${common}>${content}</text>`;
}

/** A tab filling the lower left corner up to a size, its inner corner rounded. */
function cornerTab(size: number, corner: number, fill: string): string {
  const top = round(VIEWBOX - size);

  return (
    `<path d="M 0 ${top} H ${round(size - corner)} A ${corner} ${corner} 0 0 1 ${size} ${round(top + corner)} ` +
    `V ${VIEWBOX} H 0 Z" fill="${fill}"/>`
  );
}

/** The steel blue tab with a white italic "i", in the lower left corner, over a dark rule. */
function informationalMark(): string {
  const scale = MARK_GLYPH_HEIGHT / 100;
  const left = round(MARK_GLYPH_X - (MARK_GLYPH_WIDTH * scale) / 2);
  const top = round(MARK_GLYPH_Y - MARK_GLYPH_HEIGHT / 2);

  return (
    cornerTab(round(MARK_SIZE + MARK_RULE), round(MARK_CORNER + MARK_RULE), MARK_RULE_COLOR) +
    cornerTab(MARK_SIZE, MARK_CORNER, MARK_FILL) +
    `<g transform="translate(${left} ${top}) scale(${round(scale)})" fill="#ffffff">` +
    `${MARK_GLYPH_DOT}<path d="${MARK_GLYPH_STEM}"/></g>`
  );
}

/**
 * The page tab: the informational tab mirrored into the lower right corner, with a white chevron.
 *
 * The chevron is the common mark for a control that opens another screen.
 */
function pageMark(): string {
  const tip = round(VIEWBOX - MARK_GLYPH_X + CHEVRON_REACH_X / 2);
  const back = round(tip - CHEVRON_REACH_X);

  return (
    `<g transform="translate(${VIEWBOX} 0) scale(-1 1)">` +
    cornerTab(round(MARK_SIZE + MARK_RULE), round(MARK_CORNER + MARK_RULE), MARK_RULE_COLOR) +
    cornerTab(MARK_SIZE, MARK_CORNER, MARK_FILL) +
    '</g>' +
    `<path d="M ${back} ${round(MARK_GLYPH_Y - CHEVRON_REACH_Y)} L ${tip} ${MARK_GLYPH_Y} ` +
    `L ${back} ${round(MARK_GLYPH_Y + CHEVRON_REACH_Y)}" fill="none" stroke="#ffffff" ` +
    `stroke-width="${CHEVRON_STROKE}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}

function bar(spec: KeyBar): string {
  const color = spec.active ? BAR_ACTIVE : BAR_INACTIVE;
  const fill = spec.fill ?? 'next';
  const emptying = fill === 'next' && spec.active;
  const becoming = fill === 'danger' ? BAR_DANGER : emptying ? BAR_INACTIVE : BAR_ACTIVE;
  const progress = clamp(spec.progress ?? 0);

  const width = round(VIEWBOX * progress);
  const from = emptying ? ` x="${round(VIEWBOX - width)}"` : '';

  const filling = progress > 0 ? `<rect${from} width="${width}" height="${BAR_HEIGHT}" fill="${becoming}"/>` : '';

  // The bar's colors either side of the fill's edge: the fill runs in from the left, or from the right while emptying.
  const edge = emptying ? round(VIEWBOX - width) : width;
  const left = progress > 0 && !emptying ? becoming : color;
  const right = emptying && progress > 0 ? becoming : color;

  return (
    `<rect width="${VIEWBOX}" height="${BAR_HEIGHT}" fill="${color}"/>` +
    filling +
    `<rect y="${BAR_HEIGHT}" width="${VIEWBOX}" height="${BAR_RULE_HEIGHT}" fill="${BAR_RULE_COLOR}"/>` +
    (spec.label === undefined ? '' : barLabel(spec.label, left, right, edge))
  );
}

/** The dark or the white that reads better on a bar color. */
function labelColor(behind: string): string {
  return contrastRatio(behind, BAR_LABEL_DARK) >= contrastRatio(behind, '#ffffff') ? BAR_LABEL_DARK : '#ffffff';
}

/**
 * A word in the middle of the bar, colored for what lies behind each part of it.
 *
 * Stream Deck applies no clip paths or masks, but it does draw gradients,
 * so the word is filled with one whose two colors meet in a hard step at
 * the fill's edge rather than blending.
 */
function barLabel(label: string, left: string, right: string, edge: number): string {
  const text =
    `font-family="${FONT_STACK}" font-size="${BAR_LABEL_SIZE}" font-weight="700" ` +
    `letter-spacing="${BAR_LABEL_SPACING}" text-anchor="middle"`;
  const y = round(BAR_HEIGHT / 2 + (BAR_LABEL_SIZE * 0.72) / 2);
  const content = escapeXml(label);
  const leftColor = labelColor(left);
  const rightColor = labelColor(right);

  if (leftColor === rightColor) {
    return `<text x="${VIEWBOX / 2}" y="${y}" fill="${leftColor}" ${text}>${content}</text>`;
  }

  return (
    `<defs><linearGradient id="bar-label" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${VIEWBOX}" y2="0">` +
    `<stop offset="${edge}%" stop-color="${leftColor}"/><stop offset="${edge}%" stop-color="${rightColor}"/>` +
    `</linearGradient></defs>` +
    `<text x="${VIEWBOX / 2}" y="${y}" fill="url(#bar-label)" ${text}>${content}</text>`
  );
}

/** Builds the SVG markup for a key. */
export function renderKeySvg(spec: KeySpec): string {
  const background = safeColor(spec.background, DEFAULT_BACKGROUND);
  const foreground = safeColor(spec.foreground, DEFAULT_FOREGROUND);

  const parts = [`<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="${background}"/>`];

  if (spec.accent !== undefined) {
    parts.push(
      `<rect width="${VIEWBOX}" height="${ACCENT_HEIGHT}" fill="${safeColor(spec.accent, foreground)}"/>` +
        `<rect y="${ACCENT_HEIGHT}" width="${VIEWBOX}" height="${BAR_RULE_HEIGHT}" fill="${BAR_RULE_COLOR}"/>`
    );
  }

  const veiled = (spec.texts ?? []).filter((line) => line.aboveVeil !== true);
  const raised = (spec.texts ?? []).filter((line) => line.aboveVeil === true);
  const content = [...(spec.shapes ?? []), ...veiled.map((line) => text(line, foreground))].join('');

  /** A key with a bar draws its content lower, so a raised line lands on the same line as the rest. */
  const placed = (markup: string): string =>
    spec.bar === undefined ? markup : `<g transform="translate(0 ${BAR_SHIFT})">${markup}</g>`;

  parts.push(placed(content));

  // The bar is drawn over the content, so a full key drawing such as the
  // Undo key's hazard striping cannot show through it.
  if (spec.bar !== undefined) {
    parts.push(bar(spec.bar));
  }

  if (spec.informational === true) {
    parts.push(informationalMark());
  }

  if (spec.opensPage === true) {
    parts.push(pageMark());
  }

  if (spec.subdued === true) {
    parts.push(`<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="#000000" opacity="${VEIL_OPACITY}"/>`);
  }

  if (raised.length > 0) {
    parts.push(placed(raised.map((line) => text(line, foreground)).join('')));
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}" ` +
    `width="${VIEWBOX}" height="${VIEWBOX}">${parts.join('')}</svg>`
  );
}

/** Builds the image Stream Deck draws on a key. */
export function renderKey(spec: KeySpec): string {
  return `data:image/svg+xml;base64,${Buffer.from(renderKeySvg(spec), 'utf8').toString('base64')}`;
}
