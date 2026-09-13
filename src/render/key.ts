/**
 * Draws a key as an SVG image.
 *
 * The drawing is written in a square viewBox rather than in pixels, so
 * one description fits every Stream Deck model: the hardware scales it
 * to whatever its keys are. Text arriving from CRG is escaped on the
 * way in, and colors are used only once they read as hex colors.
 *
 * A line of text that would run past the edge is drawn smaller rather
 * than clipped, so a long clock or a long name stays readable.
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
  readonly weight?: 'normal' | 'bold' | undefined;
  readonly color?: string | undefined;
  readonly opacity?: number | undefined;
};

/** Everything drawn on one key. */
export type KeySpec = {
  readonly background?: string | undefined;
  readonly foreground?: string | undefined;
  /** A bar across the top, used to mark a team or a state. */
  readonly accent?: string | undefined;
  /** An outline, used to mark a key as active. */
  readonly outline?: string | undefined;
  readonly texts?: readonly KeyText[] | undefined;
};

const FONT_STACK = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const ACCENT_HEIGHT = 8;

const OUTLINE_WIDTH = 5;

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

function text(line: KeyText, foreground: string): string {
  const weight = line.weight === 'bold' ? 700 : 400;
  const fill = safeColor(line.color, foreground);
  const opacity = line.opacity !== undefined && line.opacity < 1 ? ` opacity="${clamp(line.opacity)}"` : '';
  const size = round(fittedSize(line.text, line.size, line.weight ?? 'normal'));

  return (
    `<text x="${VIEWBOX / 2}" y="${line.y}" fill="${fill}" font-family="${FONT_STACK}" ` +
    `font-size="${size}" font-weight="${weight}" text-anchor="middle"${opacity}>` +
    `${escapeXml(line.text)}</text>`
  );
}

/** Keeps the generated markup short, and comparable between redraws. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Builds the SVG markup for a key. */
export function renderKeySvg(spec: KeySpec): string {
  const background = safeColor(spec.background, DEFAULT_BACKGROUND);
  const foreground = safeColor(spec.foreground, DEFAULT_FOREGROUND);

  const parts = [`<rect width="${VIEWBOX}" height="${VIEWBOX}" fill="${background}"/>`];

  if (spec.accent !== undefined) {
    parts.push(`<rect width="${VIEWBOX}" height="${ACCENT_HEIGHT}" fill="${safeColor(spec.accent, foreground)}"/>`);
  }

  if (spec.outline !== undefined) {
    const inset = OUTLINE_WIDTH / 2;

    parts.push(
      `<rect x="${inset}" y="${inset}" width="${VIEWBOX - OUTLINE_WIDTH}" height="${VIEWBOX - OUTLINE_WIDTH}" ` +
        `fill="none" stroke="${safeColor(spec.outline, foreground)}" stroke-width="${OUTLINE_WIDTH}"/>`
    );
  }

  for (const line of spec.texts ?? []) {
    parts.push(text(line, foreground));
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
