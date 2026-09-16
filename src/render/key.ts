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

import { DEFAULT_BACKGROUND, DEFAULT_FOREGROUND, escapeXml, safeColor } from './theme.ts';

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
   */
  readonly fill?: 'next' | 'active' | undefined;
};

/** Everything drawn on one key. */
export type KeySpec = {
  readonly background?: string | undefined;
  readonly foreground?: string | undefined;
  /** A thin bar across the top, used by the clocks and the connection key. */
  readonly accent?: string | undefined;
  /** Drawings from icons.ts, which build their markup only from checked colors. */
  readonly shapes?: readonly string[] | undefined;
  readonly texts?: readonly KeyText[] | undefined;
  /** The active bar; the rest of the key moves down to sit below it. */
  readonly bar?: KeyBar | undefined;
  /** The blue mark on a key that does nothing when pressed. */
  readonly informational?: boolean | undefined;
  /** A dark veil over the whole key, while CRG is disconnected. */
  readonly subdued?: boolean | undefined;
};

const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const ACCENT_HEIGHT = 8;

export const BAR_ACTIVE = '#22c55e';

export const BAR_INACTIVE = '#52525b';

const BAR_HEIGHT = 10;

/** The dark rule under the bar, which keeps it apart from a team color close to its own. */
const BAR_RULE_HEIGHT = 4;

const BAR_RULE_COLOR = '#0b0b0f';

/** How far a key's content moves down to center on the area below the bar. */
const BAR_SHIFT = 3;

/** A text shadow's offset, as a share of the font size. */
const SHADOW_OFFSET = 0.06;

const SHADOW_MIN_OFFSET = 0.9;

const MARK_FILL = '#2563eb';

const MARK_RADIUS = 7.5;

const MARK_INSET = 8;

const VEIL_OPACITY = 0.62;

/** Room a line of text is given, leaving a margin at each edge. */
const TEXT_WIDTH = 92;

/** How small a line may be shrunk before it stops being worth reading. */
const MIN_FONT_SCALE = 0.5;

/**
 * Rough character widths, as a fraction of the font size.
 *
 * Enough to tell whether a line will overflow. The renderer has no font
 * metrics, and the exact figures differ per device anyway, so the aim
 * is a size that fits rather than one that fills the key precisely.
 */
function characterWidth(character: string): number {
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

  return `${shadow}<text x="${x}" y="${line.y}" fill="${fill}" ${common}>${content}</text>`;
}

/** The blue circle with a white "i", in the lower left corner. */
function informationalMark(): string {
  const x = MARK_INSET + MARK_RADIUS;
  const y = VIEWBOX - MARK_INSET - MARK_RADIUS;
  const half = MARK_RADIUS * 0.478;
  const dot = MARK_RADIUS * 0.161;
  const stem = MARK_RADIUS * 0.3;
  const gap = MARK_RADIUS * 0.133;
  const top = y - half;
  const stemTop = top + dot * 2 + gap;

  return (
    `<circle cx="${x}" cy="${y}" r="${MARK_RADIUS}" fill="${MARK_FILL}"/>` +
    `<circle cx="${x}" cy="${round(top + dot)}" r="${round(dot)}" fill="#ffffff"/>` +
    `<rect x="${round(x - stem / 2)}" y="${round(stemTop)}" width="${round(stem)}" ` +
    `height="${round(y + half - stemTop)}" rx="${round(stem / 2)}" fill="#ffffff"/>`
  );
}

function bar(spec: KeyBar): string {
  const color = spec.active ? BAR_ACTIVE : BAR_INACTIVE;
  const emptying = spec.active && spec.fill !== 'active';
  const becoming = emptying ? BAR_INACTIVE : BAR_ACTIVE;
  const progress = clamp(spec.progress ?? 0);

  const width = round(VIEWBOX * progress);
  const from = emptying ? ` x="${round(VIEWBOX - width)}"` : '';

  const filling = progress > 0 ? `<rect${from} width="${width}" height="${BAR_HEIGHT}" fill="${becoming}"/>` : '';

  return (
    `<rect width="${VIEWBOX}" height="${BAR_HEIGHT}" fill="${color}"/>` +
    filling +
    `<rect y="${BAR_HEIGHT}" width="${VIEWBOX}" height="${BAR_RULE_HEIGHT}" fill="${BAR_RULE_COLOR}"/>`
  );
}

/** Builds the SVG markup for a key. */
export function renderKeySvg(spec: KeySpec): string {
  const background = safeColor(spec.background, DEFAULT_BACKGROUND);
  const foreground = safeColor(spec.foreground, DEFAULT_FOREGROUND);

  const parts = [`<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="${background}"/>`];

  if (spec.accent !== undefined) {
    parts.push(`<rect width="${VIEWBOX}" height="${ACCENT_HEIGHT}" fill="${safeColor(spec.accent, foreground)}"/>`);
  }

  const content = [...(spec.shapes ?? []), ...(spec.texts ?? []).map((line) => text(line, foreground))].join('');

  parts.push(spec.bar === undefined ? content : `<g transform="translate(0 ${BAR_SHIFT})">${content}</g>`);

  // The bar is drawn over the content, so a full key drawing such as the
  // Undo key's hazard striping cannot show through it.
  if (spec.bar !== undefined) {
    parts.push(bar(spec.bar));
  }

  if (spec.informational === true) {
    parts.push(informationalMark());
  }

  if (spec.subdued === true) {
    parts.push(`<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="#000000" opacity="${VEIL_OPACITY}"/>`);
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
